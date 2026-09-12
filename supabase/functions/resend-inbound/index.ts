import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";
import { Resend } from "npm:resend@6.1.0";
import { Webhook } from "npm:svix@1.76.0";
import { z } from "npm:zod@4.1.0";

const forwardingDomain = "mail.batform.online";
const alphabet = "23456789abcdefghjkmnpqrstuvwxyz";

const receivedEventSchema = z.object({
  type: z.literal("email.received"),
  data: z.object({
    email_id: z.string(),
    from: z.string(),
    to: z.array(z.string()),
    subject: z.string().nullish(),
  }),
});

type Attachment = {
  filename: string;
  content: string;
  contentType?: string;
};

type Alias = {
  id: string;
  user_id: string;
  local_part: string;
  destination: string;
  enabled: boolean;
};

type ReverseAlias = {
  id: string;
  token: string;
  sender_email: string;
  alias_id: string;
  aliases: Alias;
};

function randomToken(length: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => alphabet.charAt(byte % alphabet.length)).join("");
}

function parseAddress(value: string) {
  const match = value.match(/^\s*(?:"?([^"<]*)"?\s*)?<([^>]+)>\s*$/);
  return {
    name: match?.[1]?.trim() || undefined,
    email: (match?.[2] || value).trim().toLowerCase(),
  };
}

function getLocalPart(value: string) {
  const { email } = parseAddress(value);
  const at = email.lastIndexOf("@");
  if (at < 1 || email.slice(at + 1) !== forwardingDomain) return null;
  return email.slice(0, at);
}

function maskedFrom(localPart: string) {
  return `${localPart}@${forwardingDomain}`;
}

function bufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

async function getSecret(admin: SupabaseClient, secretName: string) {
  const { data, error } = await admin.rpc("get_batmail_secret", {
    secret_name: secretName,
  });
  if (error || !data) throw new Error(`Missing server secret: ${secretName}`);
  return data as string;
}

async function resendGet<T>(apiKey: string, path: string): Promise<T> {
  const response = await fetch(`https://api.resend.com${path}`, {
    headers: { authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`Resend API ${response.status}: ${detail}`);
  }
  return await response.json() as T;
}

async function loadAttachments(apiKey: string, emailId: string): Promise<Attachment[]> {
  const data = await resendGet<{ data?: Array<{
    filename: string;
    content_type?: string;
    download_url: string;
  }> }>(apiKey, `/emails/receiving/${encodeURIComponent(emailId)}/attachments`);

  const items = data.data || [];
  const files: Attachment[] = [];
  for (const item of items) {
    const response = await fetch(item.download_url);
    if (!response.ok) throw new Error(`Unable to download attachment: ${item.filename}`);
    files.push({
      filename: item.filename,
      content: bufferToBase64(await response.arrayBuffer()),
      contentType: item.content_type,
    });
  }
  return files;
}

async function startEmailEvent(
  admin: SupabaseClient,
  values: {
    alias_id: string;
    provider_email_id: string;
    direction: "inbound" | "reply";
    original_from: string;
    original_to: string;
    masked_sender?: string;
    subject: string | null;
  },
) {
  const inserted = await admin.from("email_events").insert({
    ...values,
    status: "processing",
  }).select("id").single();
  if (!inserted.error) return inserted.data.id as string;
  if (inserted.error.code !== "23505") throw inserted.error;

  const existing = await admin
    .from("email_events")
    .select("id,status")
    .eq("provider_email_id", values.provider_email_id)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (!existing.data || existing.data.status !== "failed") return null;

  const retried = await admin
    .from("email_events")
    .update({ status: "processing", error: null })
    .eq("id", existing.data.id)
    .select("id")
    .single();
  if (retried.error) throw retried.error;
  return retried.data.id as string;
}

async function loadReceivedMessage(apiKey: string, emailId: string) {
  const [received, attachments] = await Promise.all([
    resendGet<{ html?: string | null; text?: string | null }>(apiKey, `/emails/receiving/${encodeURIComponent(emailId)}`),
    loadAttachments(apiKey, emailId),
  ]);
  return { received, attachments };
}

async function getOrCreateReverseAlias(
  admin: SupabaseClient,
  alias: Alias,
  senderEmail: string,
) {
  const existing = await admin
    .from("reverse_aliases")
    .select("token")
    .eq("alias_id", alias.id)
    .eq("sender_email", senderEmail)
    .maybeSingle();
  if (existing.data?.token) return existing.data.token as string;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const token = randomToken(20);
    const inserted = await admin
      .from("reverse_aliases")
      .insert({ alias_id: alias.id, sender_email: senderEmail, token })
      .select("token")
      .single();
    if (!inserted.error) return inserted.data.token as string;
    if (inserted.error.code === "23505") {
      const raced = await admin
        .from("reverse_aliases")
        .select("token")
        .eq("alias_id", alias.id)
        .eq("sender_email", senderEmail)
        .maybeSingle();
      if (raced.data?.token) return raced.data.token as string;
      continue;
    }
    throw inserted.error;
  }
  throw new Error("Unable to create a reply address");
}

Deno.serve(async (request) => {
  let eventRecordId: string | null = null;
  let admin: SupabaseClient | null = null;
  let stage = "request";

  try {
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

    stage = "runtime-config";
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase runtime configuration is missing");
    admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    stage = "secrets";
    const [resendApiKey, webhookSecret] = await Promise.all([
      getSecret(admin, "batmail_resend_api_key"),
      getSecret(admin, "batmail_resend_webhook_secret"),
    ]);
    const resend = new Resend(resendApiKey);
    stage = "signature";
    const payload = await request.text();
    const id = request.headers.get("svix-id");
    const timestamp = request.headers.get("svix-timestamp");
    const signature = request.headers.get("svix-signature");
    if (!id || !timestamp || !signature) return new Response("Missing signature", { status: 400 });

    const verified = new Webhook(webhookSecret).verify(payload, {
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": signature,
    });
    const parsed = receivedEventSchema.safeParse(verified);
    if (!parsed.success) return Response.json({ accepted: true });

    stage = "recipient";
    const event = parsed.data.data;
    const recipientParts = event.to
      .map(getLocalPart)
      .filter((part): part is string => Boolean(part));
    if (!recipientParts.length) return Response.json({ accepted: true });

    const sender = parseAddress(event.from);

    stage = "alias-lookup";
    const reverseResult = await admin
      .from("reverse_aliases")
      .select("id, token, sender_email, alias_id, aliases!inner(id,user_id,local_part,destination,enabled)")
      .in("token", recipientParts)
      .limit(1)
      .maybeSingle();

    if (reverseResult.data) {
      const reverse = reverseResult.data as unknown as ReverseAlias;
      const alias = reverse.aliases;
      if (!alias.enabled || sender.email !== alias.destination.toLowerCase()) {
        return Response.json({ accepted: true, blocked: true });
      }

      stage = "event-record";
      eventRecordId = await startEmailEvent(admin, {
        alias_id: alias.id,
        provider_email_id: event.email_id,
        direction: "reply",
        original_from: sender.email,
        original_to: reverse.sender_email,
        masked_sender: maskedFrom(alias.local_part),
        subject: event.subject || null,
      });
      if (!eventRecordId) return Response.json({ accepted: true, duplicate: true });

      stage = "message-content";
      const { received, attachments } = await loadReceivedMessage(resendApiKey, event.email_id);

      stage = "reply-delivery";
      const { error: sendError } = await resend.emails.send({
        from: maskedFrom(alias.local_part),
        to: [reverse.sender_email],
        replyTo: maskedFrom(alias.local_part),
        subject: event.subject || "(no subject)",
        ...(received.html ? { html: received.html } : { text: received.text || "" }),
        attachments,
      });
      if (sendError) throw new Error(`Reply delivery failed: ${sendError.message}`);
      await admin.from("email_events").update({ status: "forwarded" }).eq("id", eventRecordId);
      return Response.json({ accepted: true });
    }

    stage = "alias-lookup";
    const aliasResult = await admin
      .from("aliases")
      .select("id,user_id,local_part,destination,enabled")
      .in("local_part", recipientParts)
      .eq("enabled", true)
      .limit(1)
      .maybeSingle();
    if (!aliasResult.data) return Response.json({ accepted: true, unmatched: true });
    const alias = aliasResult.data as Alias;

    stage = "event-record";
    eventRecordId = await startEmailEvent(admin, {
      alias_id: alias.id,
      provider_email_id: event.email_id,
      direction: "inbound",
      original_from: sender.email,
      original_to: maskedFrom(alias.local_part),
      subject: event.subject || null,
    });
    if (!eventRecordId) return Response.json({ accepted: true, duplicate: true });

    stage = "message-content";
    const { received, attachments } = await loadReceivedMessage(resendApiKey, event.email_id);

    stage = "reply-address";
    const replyToken = await getOrCreateReverseAlias(admin, alias, sender.email);
    const protectedSender = maskedFrom(replyToken);
    stage = "forward-delivery";
    const { error: sendError } = await resend.emails.send({
      from: protectedSender,
      to: [alias.destination],
      replyTo: protectedSender,
      subject: event.subject || "(no subject)",
      ...(received.html ? { html: received.html } : { text: received.text || "" }),
      attachments,
    });
    if (sendError) throw new Error(`Forwarding failed: ${sendError.message}`);

    await Promise.all([
      admin.from("email_events").update({ status: "forwarded", masked_sender: protectedSender }).eq("id", eventRecordId),
      admin.rpc("increment_alias_forwarded", { target_alias_id: alias.id }),
    ]);
    return Response.json({ accepted: true });
  } catch (error) {
    if (admin && eventRecordId) {
      await admin.from("email_events").update({
        status: "failed",
        error: error instanceof Error ? error.message.slice(0, 500) : "Unknown error",
      }).eq("id", eventRecordId);
    }
    console.error("Inbound email processing failed", error);
    return new Response(`Email processing failed at ${stage}`, { status: 500 });
  }
});

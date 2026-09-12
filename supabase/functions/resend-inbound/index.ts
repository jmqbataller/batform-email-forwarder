import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";
import { Resend } from "npm:resend@6.1.0";
import { z } from "npm:zod@4.1.0";

const forwardingDomain = "mail.batforum.online";
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

async function loadAttachments(resend: Resend, emailId: string): Promise<Attachment[]> {
  const { data, error } = await resend.emails.receiving.attachments.list({ emailId });
  if (error) throw new Error(`Unable to list attachments: ${error.message}`);

  const items = (data?.data || []) as Array<{
    filename: string;
    content_type?: string;
    download_url: string;
  }>;
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

  try {
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase runtime configuration is missing");
    admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const [resendApiKey, webhookSecret] = await Promise.all([
      getSecret(admin, "batmail_resend_api_key"),
      getSecret(admin, "batmail_resend_webhook_secret"),
    ]);
    const resend = new Resend(resendApiKey);
    const payload = await request.text();
    const id = request.headers.get("svix-id");
    const timestamp = request.headers.get("svix-timestamp");
    const signature = request.headers.get("svix-signature");
    if (!id || !timestamp || !signature) return new Response("Missing signature", { status: 400 });

    const verified = resend.webhooks.verify({
      payload,
      headers: { id, timestamp, signature },
      webhookSecret,
    });
    const parsed = receivedEventSchema.safeParse(verified);
    if (!parsed.success) return Response.json({ accepted: true });

    const event = parsed.data.data;
    const recipientParts = event.to
      .map(getLocalPart)
      .filter((part): part is string => Boolean(part));
    if (!recipientParts.length) return Response.json({ accepted: true });

    const { data: received, error: receivedError } = await resend.emails.receiving.get(event.email_id);
    if (receivedError || !received) {
      throw new Error(`Unable to retrieve received email: ${receivedError?.message || "unknown error"}`);
    }
    const attachments = await loadAttachments(resend, event.email_id);
    const sender = parseAddress(event.from);

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

      const inserted = await admin.from("email_events").insert({
        alias_id: alias.id,
        provider_email_id: event.email_id,
        direction: "reply",
        original_from: sender.email,
        original_to: reverse.sender_email,
        masked_sender: maskedFrom(alias.local_part),
        subject: event.subject || null,
        status: "processing",
      }).select("id").single();
      if (inserted.error?.code === "23505") return Response.json({ accepted: true, duplicate: true });
      if (inserted.error) throw inserted.error;
      eventRecordId = inserted.data.id;

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

    const aliasResult = await admin
      .from("aliases")
      .select("id,user_id,local_part,destination,enabled")
      .in("local_part", recipientParts)
      .eq("enabled", true)
      .limit(1)
      .maybeSingle();
    if (!aliasResult.data) return Response.json({ accepted: true, unmatched: true });
    const alias = aliasResult.data as Alias;

    const inserted = await admin.from("email_events").insert({
      alias_id: alias.id,
      provider_email_id: event.email_id,
      direction: "inbound",
      original_from: sender.email,
      original_to: maskedFrom(alias.local_part),
      subject: event.subject || null,
      status: "processing",
    }).select("id").single();
    if (inserted.error?.code === "23505") return Response.json({ accepted: true, duplicate: true });
    if (inserted.error) throw inserted.error;
    eventRecordId = inserted.data.id;

    const replyToken = await getOrCreateReverseAlias(admin, alias, sender.email);
    const protectedSender = maskedFrom(replyToken);
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
    return new Response("Email processing failed", { status: 500 });
  }
});

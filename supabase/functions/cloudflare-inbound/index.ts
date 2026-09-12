import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";
import { Resend } from "npm:resend@6.1.0";
import { z } from "npm:zod@4.1.0";

const forwardingDomain = "mail.batform.online";
const alphabet = "23456789abcdefghjkmnpqrstuvwxyz";

const prepareSchema = z.object({
  action: z.literal("prepare"),
  provider_email_id: z.string().min(1).max(500),
  from: z.string().min(3).max(320),
  to: z.string().min(3).max(320),
  subject: z.string().max(2_000).nullable(),
  text_body: z.string().max(500_000).nullable(),
});

const completeSchema = z.object({
  action: z.literal("complete"),
  event_id: z.uuid(),
  status: z.enum(["forwarded", "failed"]),
  error: z.string().max(500).optional(),
});

const attachmentSchema = z.object({
  content: z.string().max(8_000_000),
  filename: z.string().min(1).max(500),
  type: z.string().min(1).max(200),
  disposition: z.enum(["attachment", "inline"]),
  contentId: z.string().max(500).optional(),
});

const relayReplySchema = z.object({
  action: z.literal("relay-reply"),
  event_id: z.uuid(),
  subject: z.string().max(2_000).nullable(),
  text: z.string().max(5_000_000),
  html: z.string().max(5_000_000).nullable(),
  attachments: z.array(attachmentSchema).max(32),
});

const relayInboundSchema = z.object({
  action: z.literal("relay-inbound"),
  event_id: z.uuid(),
  subject: z.string().max(2_000).nullable(),
  text: z.string().max(5_000_000),
  html: z.string().max(5_000_000).nullable(),
  attachments: z.array(attachmentSchema).max(32),
});

const requestSchema = z.discriminatedUnion("action", [
  prepareSchema,
  completeSchema,
  relayInboundSchema,
  relayReplySchema,
]);

type Alias = {
  id: string;
  user_id: string;
  local_part: string;
  destination: string;
  label: string | null;
  enabled: boolean;
};

type ReverseAlias = {
  id: string;
  token: string;
  sender_email: string;
  alias_id: string;
  aliases: Alias;
};

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function randomToken(length: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => alphabet.charAt(byte % alphabet.length)).join("");
}

function normalizeAddress(value: string) {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] || value).trim().toLowerCase();
}

function getLocalPart(value: string) {
  const email = normalizeAddress(value);
  const at = email.lastIndexOf("@");
  if (at < 1 || email.slice(at + 1) !== forwardingDomain) return null;
  return email.slice(0, at);
}

function maskedFrom(localPart: string) {
  return `${localPart}@${forwardingDomain}`;
}

function secretsMatch(provided: string, expected: string) {
  const left = new TextEncoder().encode(provided);
  const right = new TextEncoder().encode(expected);
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

async function getSecret(admin: SupabaseClient, secretName: string) {
  const { data, error } = await admin.rpc("get_batmail_secret", {
    secret_name: secretName,
  });
  if (error || !data) throw new Error(`Missing server secret: ${secretName}`);
  return data as string;
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
    text_body: string | null;
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
    .update({ status: "processing", error: null, text_body: values.text_body })
    .eq("id", existing.data.id)
    .select("id")
    .single();
  if (retried.error) throw retried.error;
  return retried.data.id as string;
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
  if (existing.error) throw existing.error;
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
      if (raced.error) throw raced.error;
      if (raced.data?.token) return raced.data.token as string;
      continue;
    }
    throw inserted.error;
  }
  throw new Error("Unable to create a reply address");
}

async function prepareRoute(
  admin: SupabaseClient,
  input: z.infer<typeof prepareSchema>,
) {
  const localPart = getLocalPart(input.to);
  if (!localPart) return json({ action: "reject", reason: "Unknown BatMail domain" });

  const sender = normalizeAddress(input.from);
  const reverseResult = await admin
    .from("reverse_aliases")
    .select("id,token,sender_email,alias_id,aliases!inner(id,user_id,local_part,destination,label,enabled)")
    .eq("token", localPart)
    .limit(1)
    .maybeSingle();
  if (reverseResult.error) throw reverseResult.error;

  if (reverseResult.data) {
    const reverse = reverseResult.data as unknown as ReverseAlias;
    const alias = reverse.aliases;
    if (!alias.enabled || sender !== alias.destination.toLowerCase()) {
      return json({ action: "reject", reason: "Reply address is not authorized" });
    }

    const eventId = await startEmailEvent(admin, {
      alias_id: alias.id,
      provider_email_id: input.provider_email_id,
      direction: "reply",
      original_from: sender,
      original_to: reverse.sender_email,
      masked_sender: maskedFrom(alias.local_part),
      subject: input.subject,
      text_body: input.text_body,
    });
    return json(eventId ? { action: "reply", eventId } : { action: "duplicate" });
  }

  const aliasResult = await admin
    .from("aliases")
    .select("id,user_id,local_part,destination,label,enabled")
    .eq("local_part", localPart)
    .eq("enabled", true)
    .limit(1)
    .maybeSingle();
  if (aliasResult.error) throw aliasResult.error;
  if (!aliasResult.data) {
    return json({ action: "reject", reason: "Unknown or inactive BatMail alias" });
  }

  const alias = aliasResult.data as Alias;
  const eventId = await startEmailEvent(admin, {
    alias_id: alias.id,
    provider_email_id: input.provider_email_id,
    direction: "inbound",
    original_from: sender,
    original_to: maskedFrom(alias.local_part),
    subject: input.subject,
    text_body: input.text_body,
  });
  if (!eventId) return json({ action: "duplicate" });

  const replyToken = await getOrCreateReverseAlias(admin, alias, sender);
  const protectedSender = maskedFrom(replyToken);
  const updated = await admin
    .from("email_events")
    .update({ masked_sender: protectedSender })
    .eq("id", eventId);
  if (updated.error) throw updated.error;

  return json({
    action: "forward",
    eventId,
  });
}

async function completeForward(
  admin: SupabaseClient,
  input: z.infer<typeof completeSchema>,
) {
  const updated = await admin
    .from("email_events")
    .update({
      status: input.status,
      error: input.status === "failed" ? input.error || "Cloudflare delivery failed" : null,
    })
    .eq("id", input.event_id)
    .eq("direction", "inbound")
    .eq("status", "processing")
    .select("alias_id")
    .maybeSingle();
  if (updated.error) throw updated.error;

  if (input.status === "forwarded" && updated.data?.alias_id) {
    const counted = await admin.rpc("increment_alias_forwarded", {
      target_alias_id: updated.data.alias_id,
    });
    if (counted.error) throw counted.error;
  }
  return json({ accepted: true });
}

async function relayReply(
  admin: SupabaseClient,
  input: z.infer<typeof relayReplySchema>,
) {
  const eventResult = await admin
    .from("email_events")
    .select("id,status,direction,original_to,masked_sender")
    .eq("id", input.event_id)
    .maybeSingle();
  if (eventResult.error) throw eventResult.error;
  const event = eventResult.data;
  if (!event || event.direction !== "reply") return json({ error: "Reply event not found" }, 404);
  if (event.status === "forwarded") return json({ accepted: true });
  if (event.status !== "processing" || !event.original_to || !event.masked_sender) {
    return json({ error: "Reply event is not deliverable" }, 409);
  }

  try {
    const resendApiKey = await getSecret(admin, "batmail_resend_api_key");
    const resend = new Resend(resendApiKey);
    const { error } = await resend.emails.send({
      from: event.masked_sender,
      to: [event.original_to],
      replyTo: event.masked_sender,
      subject: input.subject || "(no subject)",
      ...(input.html ? { html: input.html, text: input.text || undefined } : { text: input.text }),
      attachments: input.attachments.map((attachment) => ({
        content: attachment.content,
        filename: attachment.filename,
        contentType: attachment.type,
        ...(attachment.contentId ? { contentId: attachment.contentId } : {}),
      })),
    });
    if (error) throw new Error(`Reply delivery failed: ${error.message}`);

    const updated = await admin
      .from("email_events")
      .update({ status: "forwarded", error: null })
      .eq("id", event.id);
    if (updated.error) throw updated.error;
    return json({ accepted: true });
  } catch (error) {
    const detail = error instanceof Error ? error.message.slice(0, 500) : "Reply delivery failed";
    await admin
      .from("email_events")
      .update({ status: "failed", error: detail })
      .eq("id", event.id);
    throw error;
  }
}

async function relayInbound(
  admin: SupabaseClient,
  input: z.infer<typeof relayInboundSchema>,
) {
  const eventResult = await admin
    .from("email_events")
    .select("id,status,direction,alias_id,masked_sender")
    .eq("id", input.event_id)
    .maybeSingle();
  if (eventResult.error) throw eventResult.error;
  const event = eventResult.data;
  if (!event || event.direction !== "inbound") {
    return json({ error: "Inbound event not found" }, 404);
  }
  if (event.status === "forwarded") return json({ accepted: true });
  if (event.status !== "processing" || !event.alias_id || !event.masked_sender) {
    return json({ error: "Inbound event is not deliverable" }, 409);
  }

  const aliasResult = await admin
    .from("aliases")
    .select("id,destination,enabled")
    .eq("id", event.alias_id)
    .eq("enabled", true)
    .maybeSingle();
  if (aliasResult.error) throw aliasResult.error;
  if (!aliasResult.data) return json({ error: "Alias is inactive" }, 409);

  try {
    const resendApiKey = await getSecret(admin, "batmail_resend_api_key");
    const resend = new Resend(resendApiKey);
    const { error } = await resend.emails.send(
      {
        from: event.masked_sender,
        to: [aliasResult.data.destination],
        replyTo: event.masked_sender,
        subject: input.subject || "(no subject)",
        ...(input.html
          ? { html: input.html, text: input.text || undefined }
          : { text: input.text }),
        attachments: input.attachments.map((attachment) => ({
          content: attachment.content,
          filename: attachment.filename,
          contentType: attachment.type,
          ...(attachment.contentId ? { contentId: attachment.contentId } : {}),
        })),
      },
      { idempotencyKey: `batmail-inbound/${event.id}` },
    );
    if (error) throw new Error(`Inbound delivery failed: ${error.message}`);

    const updated = await admin
      .from("email_events")
      .update({ status: "forwarded", error: null })
      .eq("id", event.id)
      .eq("status", "processing");
    if (updated.error) throw updated.error;

    const counted = await admin.rpc("increment_alias_forwarded", {
      target_alias_id: aliasResult.data.id,
    });
    if (counted.error) throw counted.error;
    return json({ accepted: true });
  } catch (error) {
    const detail = error instanceof Error
      ? error.message.slice(0, 500)
      : "Inbound delivery failed";
    await admin
      .from("email_events")
      .update({ status: "failed", error: detail })
      .eq("id", event.id)
      .eq("status", "processing");
    throw error;
  }
}

Deno.serve(async (request) => {
  try {
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase runtime configuration is missing");

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const expectedSecret = await getSecret(admin, "batmail_cloudflare_worker_secret");
    const providedSecret = request.headers.get("x-batmail-worker-secret") || "";
    if (!secretsMatch(providedSecret, expectedSecret)) return json({ error: "Unauthorized" }, 401);

    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return json({ error: "Invalid request" }, 400);

    switch (parsed.data.action) {
      case "prepare":
        return await prepareRoute(admin, parsed.data);
      case "complete":
        return await completeForward(admin, parsed.data);
      case "relay-inbound":
        return await relayInbound(admin, parsed.data);
      case "relay-reply":
        return await relayReply(admin, parsed.data);
    }
  } catch (error) {
    console.error("Cloudflare email bridge failed", error);
    return json({ error: "Email processing failed" }, 500);
  }
});

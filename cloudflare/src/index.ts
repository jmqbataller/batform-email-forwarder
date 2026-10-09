import PostalMime from "postal-mime";

const MAX_FORWARD_SIZE = 5 * 1024 * 1024;
const MAX_STORED_TEXT = 500_000;

type Env = {
  BATMAIL_WORKER_SECRET: string;
  FORWARDING_DOMAIN: string;
  RELAY_DOMAIN?: string;
  LEGACY_FORWARDING_DOMAIN?: string;
  LEGACY_FORWARDING_DOMAINS?: string;
  SUPABASE_EDGE_URL: string;
  TEMP_FORWARD_TO: string;
  EMAIL: SendEmail;
};

type RoutePlan =
  | { action: "duplicate" }
  | { action: "reject"; reason: string }
  | {
      action: "forward";
      eventId: string;
    }
  | {
      action: "reply";
      eventId: string;
    };

type BackendResult = RoutePlan | { accepted: true };

export function normalizeAddress(value: string) {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] || value).trim().toLowerCase();
}

export function localPartFor(value: string, domain: string) {
  const address = normalizeAddress(value);
  const at = address.lastIndexOf("@");
  if (at < 1 || address.slice(at + 1) !== domain.toLowerCase()) return null;
  return address.slice(0, at);
}

export function acceptedLocalPart(value: string, env: Pick<Env, "FORWARDING_DOMAIN" | "LEGACY_FORWARDING_DOMAIN" | "LEGACY_FORWARDING_DOMAINS">) {
  const domains = new Set([env.FORWARDING_DOMAIN, "cspro.space", "dnd.cspro.space", "beng.canvasphere.cyou", "mail.batform.online", env.LEGACY_FORWARDING_DOMAIN, ...(env.LEGACY_FORWARDING_DOMAINS || "").split(",")]);
  for (const domain of domains) {
    if (!domain?.trim()) continue;
    const localPart = localPartFor(value, domain.trim());
    if (localPart) return localPart;
  }
  return null;
}

export function toStoredText(value: string | undefined) {
  const normalized = (value || "").replaceAll("\0", "").trim();
  return normalized.slice(0, MAX_STORED_TEXT) || null;
}

export function sanitizeError(error: unknown) {
  return (error instanceof Error ? error.message : "Unknown processing error")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 500);
}

export function generateRelayLabel() {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  const bytes = crypto.getRandomValues(new Uint8Array(7));
  const letters = Array.from(bytes.slice(0, 6), (byte) => alphabet[byte % alphabet.length]).join("");
  const number = 10 + (bytes[6] % 90);
  return `${letters}+${number}`;
}

export function shouldSuppressGmailForward(subject: string | null) {
  return (subject || "").trim().toLowerCase().includes("a new member has joined your team");
}

async function sha256Hex(value: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function callBackend(env: Env, payload: Record<string, unknown>) {
  const response = await fetch(env.SUPABASE_EDGE_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-batmail-worker-secret": env.BATMAIL_WORKER_SECRET,
    },
    body: JSON.stringify(payload),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`BatMail backend ${response.status}: ${body.slice(0, 300)}`);
  }
  return JSON.parse(body) as BackendResult;
}

function mapAttachments(
  attachments: Awaited<ReturnType<typeof PostalMime.parse>>["attachments"],
): EmailAttachment[] {
  return attachments.map((attachment) => {
    const shared = {
      content: attachment.content,
      filename: attachment.filename || "attachment",
      type: attachment.mimeType || "application/octet-stream",
    };
    if (attachment.disposition === "inline" && attachment.contentId) {
      return { ...shared, disposition: "inline", contentId: attachment.contentId };
    }
    return { ...shared, disposition: "attachment" };
  });
}

function serializeAttachments(attachments: EmailAttachment[]) {
  return attachments.map((attachment) => ({
    ...attachment,
    content: attachment.content instanceof ArrayBuffer
      ? arrayBufferToBase64(attachment.content)
      : ArrayBuffer.isView(attachment.content)
        ? arrayBufferToBase64(
            attachment.content.buffer.slice(
              attachment.content.byteOffset,
              attachment.content.byteOffset + attachment.content.byteLength,
            ) as ArrayBuffer,
          )
        : attachment.content,
  }));
}

export default {
  async email(message, env): Promise<void> {
    let eventId: string | null = null;
    let direction: "inbound" | "reply" | null = null;

    try {
      const localPart = acceptedLocalPart(message.to, env);
      if (!localPart) {
        message.setReject("Unknown BatMail domain");
        return;
      }
      if (message.rawSize > MAX_FORWARD_SIZE) {
        message.setReject("Message exceeds BatMail's 5 MiB forwarding limit");
        return;
      }

      const raw = await new Response(message.raw).arrayBuffer();
      const parsed = await PostalMime.parse(raw);
      const providerId = `cf:${await sha256Hex(raw)}:${normalizeAddress(message.to)}`;
      const sender = normalizeAddress(message.from);
      const subject = parsed.subject || message.headers.get("subject") || null;

      if (shouldSuppressGmailForward(subject)) {
        console.info("Dropped filtered Canva team membership notification", {
          from: sender,
          to: normalizeAddress(message.to),
          subject,
        });
        return;
      }

      const plan = await callBackend(env, {
        action: "prepare",
        provider_email_id: providerId,
        from: sender,
        to: normalizeAddress(message.to),
        subject,
        text_body: toStoredText(parsed.text),
      }) as RoutePlan;

      if (plan.action === "reject") {
        message.setReject(plan.reason);
        return;
      }
      if (plan.action === "duplicate") return;

      eventId = plan.eventId;
      const attachments = mapAttachments(parsed.attachments);

      if (plan.action === "reply") {
        direction = "reply";
        await callBackend(env, {
          action: "relay-reply",
          event_id: plan.eventId,
          subject,
          text: parsed.text || "",
          html: parsed.html || null,
          attachments: serializeAttachments(attachments),
        });
        return;
      }

      direction = "inbound";

      try {
        await env.EMAIL.send({
          to: env.TEMP_FORWARD_TO,
          from: {
            email: `relay@${env.RELAY_DOMAIN || env.FORWARDING_DOMAIN}`,
            name: generateRelayLabel(),
          },
          replyTo: sender,
          subject: subject || "(No subject)",
          text: parsed.text || "Forwarded email received by BatMail.",
          html: parsed.html || undefined,
          attachments,
          headers: {
            "X-BatMail-Original-From": sender,
            "X-BatMail-Original-To": normalizeAddress(message.to),
          },
        });
      } catch (relayError) {
        const relayDetail = sanitizeError(relayError);
        if (!relayDetail.toLowerCase().includes("temporary delivery failure")) {
          throw relayError;
        }

        console.warn("Cloudflare authenticated relay deferred by destination; trying direct forward", {
          detail: relayDetail,
          eventId: plan.eventId,
          to: env.TEMP_FORWARD_TO,
        });
        await message.forward(env.TEMP_FORWARD_TO);
      }

      try {
        await callBackend(env, {
          action: "complete",
          event_id: plan.eventId,
          status: "forwarded",
        });
      } catch (statusError) {
        console.error("BatMail forward status update failed after Cloudflare delivery", {
          detail: sanitizeError(statusError),
          eventId: plan.eventId,
        });
      }
      return;
    } catch (error) {
      const detail = sanitizeError(error);
      console.error("BatMail email processing failed", {
        detail,
        direction,
        eventId,
        from: message.from,
        to: message.to,
      });

      if (eventId && direction === "inbound") {
        try {
          await callBackend(env, {
            action: "complete",
            event_id: eventId,
            status: "failed",
            error: detail,
          });
        } catch (statusError) {
          console.error("BatMail status update failed", sanitizeError(statusError));
        }
      }
      throw error;
    }
  },
} satisfies ExportedHandler<Env>;

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

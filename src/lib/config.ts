export const forwardingDomain =
  process.env.FORWARDING_DOMAIN || "mail.batforum.online";

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://aliases.batforum.online";

export const allowSignups =
  process.env.NEXT_PUBLIC_ALLOW_SIGNUPS === "true";

export function requireServerConfig() {
  const values = {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseSecretKey: process.env.SUPABASE_SECRET_KEY,
    resendApiKey: process.env.RESEND_API_KEY,
    resendWebhookSecret: process.env.RESEND_WEBHOOK_SECRET,
  };

  const missing = Object.entries(values)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length) {
    throw new Error(`Missing server configuration: ${missing.join(", ")}`);
  }

  return values as { [K in keyof typeof values]: string };
}

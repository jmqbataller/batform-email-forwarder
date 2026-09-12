export const forwardingDomain =
  process.env.FORWARDING_DOMAIN || "mail.batforum.online";

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://aliases.batforum.online";

export const allowSignups =
  process.env.NEXT_PUBLIC_ALLOW_SIGNUPS === "true";

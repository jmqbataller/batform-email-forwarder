export const forwardingDomain = "cspro.space";
export const legacyAliasDomain = "dnd.cspro.space";
export const canvasphereAliasDomain = "beng.canvasphere.cyou";
export const canvasphereRootDomain = "canvasphere.cyou";
export const aliasDomains = [forwardingDomain, legacyAliasDomain, canvasphereRootDomain, canvasphereAliasDomain] as const;

export function aliasAddress(alias: { local_part: string; domain?: string }) {
  return `${alias.local_part}@${alias.domain || legacyAliasDomain}`;
}

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://aliases.batform.online";

export const allowSignups =
  process.env.NEXT_PUBLIC_ALLOW_SIGNUPS === "true";

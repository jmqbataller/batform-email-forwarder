export const primaryDomain = "cspro.space";
export const legacyAliasDomain = "dnd.cspro.space";
export const canvasphereAliasDomain = "beng.canvasphere.cyou";
export const canvasphereRootDomain = "canvasphere.cyou";

export function recipientFor(value: string) {
  const match = value.match(/<([^>]+)>/);
  const address = (match?.[1] || value).trim().toLowerCase();
  const at = address.lastIndexOf("@");
  if (at < 1) return null;
  const domain = address.slice(at + 1);
  if (![primaryDomain, legacyAliasDomain, canvasphereRootDomain, canvasphereAliasDomain, "mail.batform.online"].includes(domain)) return null;
  return { local_part: address.slice(0, at), domain: domain === "mail.batform.online" ? legacyAliasDomain : domain, address };
}

export function maskedAddress(localPart: string, domain: string) {
  return `${localPart}@${domain}`;
}

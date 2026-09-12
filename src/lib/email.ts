export type ParsedAddress = {
  email: string;
  name?: string;
};

export function parseAddress(value: string): ParsedAddress {
  const match = value.match(/^\s*(?:"?([^"<]*)"?\s*)?<([^>]+)>\s*$/);
  if (!match) return { email: value.trim().toLowerCase() };
  return {
    name: match[1]?.trim() || undefined,
    email: match[2].trim().toLowerCase(),
  };
}

export function getLocalPart(value: string, expectedDomain: string) {
  const { email } = parseAddress(value);
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  if (email.slice(at + 1).toLowerCase() !== expectedDomain.toLowerCase()) {
    return null;
  }
  return email.slice(0, at).toLowerCase();
}

export function maskedFrom(localPart: string, domain: string) {
  return `${localPart}@${domain}`;
}

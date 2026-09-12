import { randomBytes } from "node:crypto";

const alphabet = "23456789abcdefghjkmnpqrstuvwxyz";

export function randomToken(length = 10) {
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export function normalizeLocalPart(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 48);
}

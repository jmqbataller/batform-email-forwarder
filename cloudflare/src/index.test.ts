import assert from "node:assert/strict";
import test from "node:test";

import {
  createFallbackHeaders,
  isCloudflareFallback,
  localPartFor,
  normalizeAddress,
  sanitizeError,
  toStoredText,
} from "./index.ts";

test("normalizes envelope and display-name addresses", () => {
  assert.equal(normalizeAddress('Sender Name <Person@Example.com>'), "person@example.com");
  assert.equal(normalizeAddress("Person@Example.com"), "person@example.com");
});

test("accepts only the configured forwarding domain", () => {
  assert.equal(localPartFor("abc123@mail.batform.online", "mail.batform.online"), "abc123");
  assert.equal(localPartFor("abc123@example.com", "mail.batform.online"), null);
});

test("sanitizes stored content and operational errors", () => {
  assert.equal(toStoredText("  hello\0 world  "), "hello world");
  assert.equal(sanitizeError(new Error("line one\nline two")), "line one line two");
});

test("recognizes a provider-quota fallback and creates safe tracking headers", () => {
  const fallback = {
    accepted: false as const,
    fallback: "cloudflare" as const,
    reason: "provider_quota" as const,
    destination: "owner@example.com",
    label: "Canva\r\ntest",
    protectedSender: "random123@mail.batform.online",
  };

  assert.equal(isCloudflareFallback(fallback), true);
  const headers = createFallbackHeaders("alias@mail.batform.online", fallback);
  assert.equal(headers.get("X-BatMail-Delivery"), "provider-quota-fallback");
  assert.equal(headers.get("X-BatMail-Label"), "Canva test");
  assert.equal(
    headers.get("X-BatMail-Protected-Sender"),
    "random123@mail.batform.online",
  );
});

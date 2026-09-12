import assert from "node:assert/strict";
import test from "node:test";

import {
  localPartFor,
  normalizeAddress,
  sanitizeError,
  toHeaderValue,
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
  assert.equal(toHeaderValue(" Canva\r\nAlias ", "Unlabeled"), "Canva Alias");
  assert.equal(toHeaderValue(null, "Unlabeled"), "Unlabeled");
});

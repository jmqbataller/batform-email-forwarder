import assert from "node:assert/strict";
import test from "node:test";

import {
  generateRelayLabel,
  localPartFor,
  normalizeAddress,
  sanitizeError,
  shouldSuppressGmailForward,
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


test("generates randomized relay labels", () => {
  const label = generateRelayLabel();
  assert.match(label, /^[a-z]{6}\+[1-9][0-9]$/);
});


test("filters Canva team-join notifications from Gmail forwarding", () => {
  assert.equal(shouldSuppressGmailForward("A new Member has joined your team!"), true);
  assert.equal(shouldSuppressGmailForward("a new member has joined your team!"), true);
  assert.equal(shouldSuppressGmailForward("Your Canva code is 123456"), false);
  assert.equal(shouldSuppressGmailForward("Welcome to Canva Business"), false);
});


test("drops filtered Canva notification before storage", () => {
  assert.equal(shouldSuppressGmailForward("A new Member has joined your team!"), true);
  assert.equal(shouldSuppressGmailForward("Your Canva code is 123456"), false);
});

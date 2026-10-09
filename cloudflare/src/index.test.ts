import assert from "node:assert/strict";
import test from "node:test";
import worker from "./index.ts";

import {
  generateRelayLabel,
  acceptedLocalPart,
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

test("accepts apex and existing alias domains while rejecting unrelated recipients", () => {
  const env = { FORWARDING_DOMAIN: "cspro.space", LEGACY_FORWARDING_DOMAIN: "mail.batform.online" };
  assert.equal(acceptedLocalPart("abc123@cspro.space", env), "abc123");
  assert.equal(acceptedLocalPart("abc123@dnd.cspro.space", env), "abc123");
  assert.equal(acceptedLocalPart("abc123@beng.canvasphere.cyou", env), "abc123");
  assert.equal(acceptedLocalPart("abc123@canvasphere.cyou", env), "abc123");
  assert.equal(acceptedLocalPart("abc123@other.canvasphere.cyou", env), null);
  assert.equal(acceptedLocalPart("abc123@mail.batform.online", env), "abc123");
  assert.equal(acceptedLocalPart("abc123@other.cspro.space", env), null);
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

test("processes apex and legacy MIME mail through storage and the configured Gmail relay", async () => {
  const originalFetch = globalThis.fetch;
  const sent: Record<string, unknown>[] = [];
  const requests: Record<string, unknown>[] = [];
  globalThis.fetch = async (_url, options) => {
    const payload = JSON.parse(String(options?.body));
    requests.push(payload);
    return Response.json(payload.action === "prepare" ? { action: "forward", eventId: "test-event" } : { accepted: true });
  };
  try {
    for (const domain of ["cspro.space", "dnd.cspro.space", "canvasphere.cyou", "beng.canvasphere.cyou"]) {
      const recipient = `abc123@${domain}`;
      const mime = new TextEncoder().encode(`From: sender@example.com\r\nTo: ${recipient}\r\nSubject: Verification message\r\nContent-Type: text/plain\r\n\r\nVerification content\r\n`);
      const message = {
        from: "sender@example.com", to: recipient, rawSize: mime.length,
        headers: new Headers({ subject: "Verification message" }),
        raw: new ReadableStream({ start(controller) { controller.enqueue(mime); controller.close(); } }),
        setReject(reason: string) { throw new Error(reason); },
      } as Parameters<typeof worker.email>[0];
      const env = {
        BATMAIL_WORKER_SECRET: "configured-secret", FORWARDING_DOMAIN: "cspro.space", RELAY_DOMAIN: "dnd.cspro.space",
        SUPABASE_EDGE_URL: "https://backend.example", TEMP_FORWARD_TO: "leejessica0469@gmail.com",
        EMAIL: { async send(payload: Record<string, unknown>) { sent.push(payload); } },
      } as unknown as Parameters<typeof worker.email>[1];
      await worker.email(message, env);
    }
    assert.equal(sent.length, 4);
    for (const delivery of sent) {
      assert.equal(delivery.to, "leejessica0469@gmail.com");
      assert.equal((delivery.from as { email: string }).email, "relay@dnd.cspro.space");
      assert.equal(delivery.subject, "Verification message");
      assert.match(String(delivery.text), /Verification content/);
    }
    assert.deepEqual(requests.filter((request) => request.action === "prepare").map((request) => request.to), ["abc123@cspro.space", "abc123@dnd.cspro.space", "abc123@canvasphere.cyou", "abc123@beng.canvasphere.cyou"]);
    assert.equal(requests.filter((request) => request.action === "complete" && request.status === "forwarded").length, 4);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

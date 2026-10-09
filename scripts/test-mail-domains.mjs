import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";

const aliases = [
  { id: "11111111-1111-4111-8111-111111111111", local_part: "apex123456", domain: "cspro.space", user_id: "owner", destination: "owner@example.com", enabled: true },
  { id: "22222222-2222-4222-8222-222222222222", local_part: "legacy1234", domain: "dnd.cspro.space", user_id: "owner", destination: "owner@example.com", enabled: true },
  { id: "33333333-3333-4333-8333-333333333333", local_part: "beng123456", domain: "beng.canvasphere.cyou", user_id: "owner", destination: "leejessica0469@gmail.com", enabled: true },
];
const events = [];
const reverse = [];
let handler;
const client = {
  async rpc(name) { return { data: name === "get_batmail_secret" ? "worker-secret" : null }; },
  from(table) {
    const source = table === "aliases" ? aliases : table === "email_events" ? events : reverse;
    let inserted;
    let updated;
    const filters = [];
    const query = {
      select() { return this; },
      eq(key, value) { filters.push([key, value]); return this; },
      limit() { return this; },
      insert(values) { inserted = values; return this; },
      update(values) { updated = values; return this; },
      execute() {
        if (inserted) {
          if (table === "email_events" && source.some((row) => row.provider_email_id === inserted.provider_email_id)) return { error: { code: "23505" } };
          const row = { id: webcrypto.randomUUID(), ...inserted };
          source.push(row);
          inserted = null;
          return { data: row };
        }
        const rows = source.filter((row) => filters.every(([key, value]) => row[key] === value));
        if (updated) rows.forEach((row) => Object.assign(row, updated));
        const row = rows[0];
        return { data: row && table === "reverse_aliases" ? { ...row, aliases: aliases.find((alias) => alias.id === row.alias_id) } : row || null };
      },
      async single() { return this.execute(); },
      async maybeSingle() { return this.execute(); },
      then(resolve, reject) { return Promise.resolve(this.execute()).then(resolve, reject); },
    };
    return query;
  },
};
function evaluate(path, dependencies) {
  const code = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Request, Response, TextEncoder, crypto: webcrypto, process: { env: {} }, Deno: { env: { get: () => "configured" }, serve: (callback) => { handler = callback; } }, require(name) {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency ${name}`);
    return dependencies[name];
  } });
  return exports;
}
const domains = evaluate("supabase/functions/_shared/mail-domains.ts", {});
const config = evaluate("src/lib/config.ts", {});
assert.equal(config.aliasAddress(aliases[0]), "apex123456@cspro.space");
assert.equal(config.aliasAddress(aliases[1]), "legacy1234@dnd.cspro.space");
assert.equal(config.aliasAddress(aliases[2]), "beng123456@beng.canvasphere.cyou");
assert.equal(config.aliasDomains.includes("beng.canvasphere.cyou"), true);
assert.equal(config.aliasAddress({ local_part: "cachedold" }), "cachedold@dnd.cspro.space");
assert.equal(domains.recipientFor("Person <Legacy1234@MAIL.BATFORM.ONLINE>").domain, "dnd.cspro.space");
assert.equal(domains.recipientFor("apex123456@other.cspro.space"), null);
evaluate("supabase/functions/cloudflare-inbound/index.ts", {
  "jsr:@supabase/functions-js/edge-runtime.d.ts": {},
  "npm:@supabase/supabase-js@2.57.4": { createClient: () => client },
  "npm:resend@6.1.0": { Resend: class { constructor() { throw new Error("Incoming receipt must not depend on Resend sending"); } } },
  "npm:zod@4.1.0": { z },
  "../_shared/mail-domains.ts": domains,
});
async function call(to, options = {}) {
  const response = await handler(new Request("https://example.com", { method: "POST", headers: { "x-batmail-worker-secret": options.secret || "worker-secret" }, body: JSON.stringify({ action: "prepare", provider_email_id: options.providerId || webcrypto.randomUUID(), from: options.from || "canva@example.com", to, subject: options.subject || "Verification code", text_body: "Test verification content" }) }));
  return { status: response.status, body: await response.json() };
}
assert.equal((await call("apex123456@cspro.space", { secret: "wrong" })).status, 401);
assert.equal(events.length, 0);
const apex = await call("apex123456@cspro.space", { providerId: "apex-delivery" });
assert.equal(apex.body.action, "forward");
assert.equal(events[0].alias_id, aliases[0].id);
assert.equal(events[0].original_to, "apex123456@cspro.space");
assert.match(events[0].masked_sender, /@cspro\.space$/);
assert.equal((await call("apex123456@cspro.space", { providerId: "apex-delivery" })).body.action, "duplicate");
assert.equal((await call("legacy1234@dnd.cspro.space")).body.action, "forward");
assert.equal(events[1].original_to, "legacy1234@dnd.cspro.space");
assert.match(events[1].masked_sender, /@dnd\.cspro\.space$/);
assert.equal((await call("legacy1234@mail.batform.online")).body.action, "forward");
const beng = await call("beng123456@beng.canvasphere.cyou");
assert.equal(beng.body.action, "forward");
assert.equal(events.at(-1).alias_id, aliases[2].id);
assert.equal(events.at(-1).original_to, "beng123456@beng.canvasphere.cyou");
assert.match(events.at(-1).masked_sender, /@beng\.canvasphere\.cyou$/);
assert.equal((await call("beng123456@canvasphere.cyou")).body.action, "reject");
assert.equal((await call("beng123456@other.canvasphere.cyou")).body.action, "reject");
assert.equal((await call("beng123456@cspro.space")).body.action, "reject");
assert.equal((await call("legacy1234@cspro.space")).body.action, "reject", "An old address must not silently become a new-domain alias");
assert.equal((await call("apex123456@dnd.cspro.space")).body.action, "reject");
assert.equal((await call("missingalias@cspro.space")).body.action, "reject");
assert.equal((await call("apex123456@unrelated.example")).body.action, "reject");
aliases[0].enabled = false;
assert.equal((await call("apex123456@cspro.space")).body.action, "reject");
const beforeFiltered = events.length;
assert.equal((await call("legacy1234@dnd.cspro.space", { subject: "A new Member has joined your team!" })).body.action, "duplicate");
assert.equal(events.length, beforeFiltered);
const replyToken = reverse.find((row) => row.alias_id === aliases[1].id).token;
assert.equal((await call(`${replyToken}@cspro.space`, { from: "owner@example.com" })).body.action, "reject", "Reply tokens must retain their alias domain");
assert.equal((await call(`${replyToken}@dnd.cspro.space`, { from: "owner@example.com" })).body.action, "reply");
console.log("Mail domain checks passed: apex receiving, legacy addresses, exact-domain isolation, authentication, duplicate deliveries, paused/unknown rejection, notification filtering, and reply ownership.");

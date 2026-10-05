import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";

const aliasId = "11111111-1111-4111-8111-111111111111";
const zoneId = "a".repeat(32);
let aliases = [{ id: aliasId, local_part: "newalias", enabled: true, user_id: "owner" }];
let secrets = {};
let rules = [];
let writes = 0;
let handler;
let providerFails = false;
let providerLimit = false;

function createClient(_url, _key, options = {}) {
  const adminUser = options.global?.headers?.Authorization === "Bearer admin";
  return {
    auth: { async getUser(jwt) { return { data: { user: ["admin", "owner"].includes(jwt) ? { id: jwt } : null } }; } },
    async rpc(name, params) {
      if (name === "is_subscription_admin") return { data: adminUser };
      if (name === "get_batmail_secret") return { data: secrets[params.secret_name] || null };
      if (name === "set_batmail_cloudflare_configuration") {
        secrets = { batmail_cloudflare_api_token: params.api_token, batmail_cloudflare_zone_id: params.zone_id };
        return {};
      }
      throw new Error(`Unexpected RPC ${name}`);
    },
    from() {
      let filtered = [...aliases];
      return {
        select() { return this; },
        eq(key, value) { filtered = filtered.filter((row) => row[key] === value); return this; },
        order() { return this; },
        async range(start, end) { return { data: filtered.slice(start, end + 1) }; },
        async maybeSingle() { return { data: filtered[0] || null }; },
      };
    },
  };
}

async function fetchMock(url, options) {
  if (providerLimit) return Response.json({ success: false, errors: [{ code: 2018, message: "sensitive submitted data" }] }, { status: 429 });
  if (providerFails) return Response.json({ success: false, errors: [{ message: "sensitive submitted data" }] }, { status: 403 });
  const path = new URL(url).pathname;
  if (path === "/client/v4/zones") return Response.json({ success: true, result: [{ id: zoneId, name: "cspro.space" }] });
  if (options.method === "GET") {
    const page = Number(new URL(url).searchParams.get("page") || 1);
    return Response.json({ success: true, result: structuredClone(rules.slice((page - 1) * 50, page * 50)), result_info: { total_count: rules.length, per_page: 50 } });
  }
  writes++;
  if (options.method === "DELETE") {
    rules = rules.filter((rule) => rule.id !== path.split("/").at(-1));
    return Response.json({ success: true, result: {} });
  }
  const body = JSON.parse(options.body);
  const id = options.method === "PUT" ? path.split("/").at(-1) : `rule-${writes}`;
  rules = rules.filter((rule) => rule.id !== id);
  const rule = { ...body, id };
  rules.push(rule);
  return Response.json({ success: true, result: rule });
}

function evaluate(file, requireFn) {
  const source = readFileSync(new URL(`../supabase/functions/cloudflare-routing/${file}`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: requireFn, fetch: fetchMock, Response, Request, AbortSignal, URL, Deno: { env: { get: () => "mock-value" }, serve: (callback) => { handler = callback; } } });
  return exports;
}
const ruleHelpers = evaluate("rules.ts", () => { throw new Error("Unexpected dependency"); });
evaluate("index.ts", (name) => {
  if (name === "./rules.ts") return ruleHelpers;
  if (name.includes("supabase-js")) return { createClient };
  if (name.includes("zod")) return { z };
  if (name.includes("edge-runtime")) return {};
  throw new Error(`Unexpected dependency ${name}`);
});

async function call(body, jwt = "owner") {
  const response = await handler(new Request("https://example.com", { method: "POST", headers: { Authorization: `Bearer ${jwt}` }, body: JSON.stringify(body) }));
  return { status: response.status, body: await response.json() };
}

assert.equal((await call({ action: "status" }, "invalid")).status, 401);
assert.equal((await call({ action: "connect", token: "t".repeat(30) })).status, 403);
assert.equal((await call({ action: "ensure", alias_id: aliasId })).status, 409);
providerFails = true;
const denied = await call({ action: "connect", token: "t".repeat(30) }, "admin");
assert.equal(denied.status, 502);
assert.ok(!JSON.stringify(denied).includes("sensitive submitted data"));
assert.equal(Object.keys(secrets).length, 0);
providerFails = false;
assert.equal((await call({ action: "connect", token: "t".repeat(30) }, "admin")).body.connected, true);
assert.equal((await call({ action: "ensure", alias_id: aliasId }, "admin")).status, 404);
assert.equal((await call({ action: "ensure", alias_id: aliasId })).body.ready, true);
assert.equal(rules[0].matchers[0].value, "newalias@dnd.cspro.space");
assert.equal(rules[0].actions[0].value[0], "batform-email-forwarder");
providerLimit = true;
const limited = await call({ action: "ensure", alias_id: aliasId });
assert.equal(limited.status, 409);
assert.match(limited.body.error, /capacity is full/);
assert.doesNotMatch(limited.body.error, /Wait a minute|sensitive submitted data/);
providerLimit = false;
const before = writes;
await call({ action: "ensure", alias_id: aliasId });
assert.equal(writes, before, "Repeated provisioning must not create duplicate rules");
const managedRule = rules[0];
rules = Array.from({ length: 55 }, (_, index) => ({ id: `unrelated-${index}`, enabled: true, matchers: [], actions: [] })).concat(managedRule);
const beforePagedCheck = writes;
await call({ action: "ensure", alias_id: aliasId });
assert.equal(writes, beforePagedCheck, "A rule beyond the first page must be found without duplicating it");
rules = [managedRule];
aliases[0].local_part = "renamed";
await call({ action: "ensure", alias_id: aliasId });
assert.equal(rules.length, 1);
assert.equal(rules[0].matchers[0].value, "renamed@dnd.cspro.space");
rules = [{ id: "manual", name: "Unrelated", enabled: true, matchers: [{ type: "literal", field: "to", value: "renamed@dnd.cspro.space" }], actions: [{ type: "forward", value: ["other@example.com"] }] }];
assert.equal((await call({ action: "ensure", alias_id: aliasId })).status, 409);
await call({ action: "remove", alias_id: aliasId });
assert.equal(rules.length, 1, "Manual rules must never be deleted");
assert.equal((await call({ action: "sync", offset: 0 })).status, 403);
const failedSync = await call({ action: "sync", offset: 0 }, "admin");
assert.equal(failedSync.body.synced, 0);
assert.equal(failedSync.body.errors.length, 1);
rules = [];
assert.equal((await call({ action: "sync", offset: 0 }, "admin")).body.synced, 1);
aliases[0].enabled = false;
assert.equal((await call({ action: "ensure", alias_id: aliasId })).status, 409);
await call({ action: "remove", alias_id: aliasId });
assert.equal(rules.length, 0);
aliases[0].enabled = true;
rules = Array.from({ length: 200 }, (_, index) => ({ id: `full-${index}`, name: `Unrelated ${index}`, enabled: true, matchers: [{ type: "literal", field: "to", value: `other${index}@dnd.cspro.space` }], actions: [{ type: "worker", value: ["batform-email-forwarder"] }] }));
rules.push({ id: "catch-all", enabled: false, matchers: [{ type: "all" }], actions: [{ type: "drop" }] });
const capacity = await call({ action: "status", check_capacity: true });
assert.equal(capacity.body.connected, true);
assert.equal(capacity.body.can_create, false);
const beforeFull = writes;
assert.equal((await call({ action: "ensure", alias_id: aliasId })).status, 409);
assert.equal(writes, beforeFull, "Full capacity must be rejected before a provider write");
rules.pop();
rules.pop();
assert.equal((await call({ action: "status", check_capacity: true })).body.can_create, true);
rules.push({ id: "catch-all", enabled: false, matchers: [{ type: "all" }], actions: [{ type: "drop" }] });
assert.equal((await call({ action: "status", check_capacity: true })).body.can_create, true, "Catch-all must not consume an address-rule slot");
console.log("Cloudflare routing checks passed: auth, ownership, configuration authorization, provisioning, idempotency, rename, conflict protection, sync errors, pause, and managed deletion.");

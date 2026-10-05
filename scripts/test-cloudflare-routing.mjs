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
  if (providerFails) return Response.json({ success: false, errors: [{ message: "sensitive submitted data" }] }, { status: 403 });
  const path = new URL(url).pathname;
  if (path === "/client/v4/zones") return Response.json({ success: true, result: [{ id: zoneId, name: "cspro.space" }] });
  if (options.method === "GET") return Response.json({ success: true, result: structuredClone(rules), result_info: { total_pages: 1 } });
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
const before = writes;
await call({ action: "ensure", alias_id: aliasId });
assert.equal(writes, before, "Repeated provisioning must not create duplicate rules");
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
console.log("Cloudflare routing checks passed: auth, ownership, configuration authorization, provisioning, idempotency, rename, conflict protection, sync errors, pause, and managed deletion.");

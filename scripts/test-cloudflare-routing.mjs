import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";

const aliasId = "11111111-1111-4111-8111-111111111111";
const zoneId = "a".repeat(32);
const canvasphereZoneId = "b".repeat(32);
let canvasphereZone = null;
let canvasphereRules = [];
let mxRecords = [];
const mxByDomain = new Map();
const writeZones = [];
let aliases = [{ id: aliasId, local_part: "newalias", enabled: true, user_id: "owner" }];
let secrets = {};
let rules = [];
let writes = 0;
let handler;
let providerFails = false;
let providerLimit = false;
let catchAll = { id: "catch-all", enabled: true, matchers: [{ type: "all" }], actions: [{ type: "worker", value: ["batform-email-forwarder"] }] };
let canvasphereCatchAll = { id: "canvasphere-catch-all", enabled: true, matchers: [{ type: "all" }], actions: [{ type: "worker", value: ["batform-email-forwarder"] }] };
const catchAllReads = [];
let lists = 0;

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
      let updated;
      return {
        update(values) { updated = values; return this; },
        select() { return this; },
        eq(key, value) { filtered = filtered.filter((row) => row[key] === value); return this; },
        order() { return this; },
        async range(start, end) { return { data: filtered.slice(start, end + 1) }; },
        async maybeSingle() { return { data: filtered[0] || null }; },
        then(resolve, reject) { if (updated) filtered.forEach((alias) => Object.assign(alias, updated)); return Promise.resolve({ data: filtered }).then(resolve, reject); },
      };
    },
  };
}

async function fetchMock(url, options) {
  if (providerLimit) return Response.json({ success: false, errors: [{ code: 2018, message: "sensitive submitted data" }] }, { status: 429 });
  if (providerFails) return Response.json({ success: false, errors: [{ message: "sensitive submitted data" }] }, { status: 403 });
  const path = new URL(url).pathname;
  if (new URL(url).hostname === "cloudflare-dns.com") return Response.json({ Status: 0, Answer: mxByDomain.get(new URL(url).searchParams.get("name")) ?? mxRecords });
  if (path === "/client/v4/zones") return Response.json({ success: true, result: new URL(url).searchParams.get("name") === "canvasphere.cyou" ? canvasphereZone ? [canvasphereZone] : [] : [{ id: zoneId, name: "cspro.space" }] });
  if (path.endsWith("/catch_all")) {
    catchAllReads.push(path.split("/")[4]);
    return Response.json({ success: true, result: structuredClone(path.includes(canvasphereZoneId) ? canvasphereCatchAll : catchAll) });
  }
  if (options.method === "GET") {
    lists++;
    const page = Number(new URL(url).searchParams.get("page") || 1);
    const scopedRules = path.includes(canvasphereZoneId) ? canvasphereRules : rules;
    return Response.json({ success: true, result: structuredClone(scopedRules.slice((page - 1) * 50, page * 50)), result_info: { total_count: scopedRules.length, per_page: 50 } });
  }
  writes++;
  writeZones.push(path.split("/")[4]);
  if (options.method === "DELETE") {
    if (path.includes(canvasphereZoneId)) canvasphereRules = canvasphereRules.filter((rule) => rule.id !== path.split("/").at(-1));
    else rules = rules.filter((rule) => rule.id !== path.split("/").at(-1));
    return Response.json({ success: true, result: {} });
  }
  const body = JSON.parse(options.body);
  const id = options.method === "PUT" ? path.split("/").at(-1) : `rule-${writes}`;
  const rule = { ...body, id };
  if (path.includes(canvasphereZoneId)) { canvasphereRules = canvasphereRules.filter((rule) => rule.id !== id); canvasphereRules.push(rule); }
  else { rules = rules.filter((rule) => rule.id !== id); rules.push(rule); }
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
aliases[0].domain = "cspro.space";
const beforeApex = writes;
const beforeApexLists = lists;
assert.equal((await call({ action: "status", check_capacity: true, domain: "cspro.space" })).body.can_create, true);
assert.equal((await call({ action: "ensure", alias_id: aliasId })).body.ready, true);
aliases[0].local_part = "anotherandom";
assert.equal((await call({ action: "ensure", alias_id: aliasId })).body.ready, true);
assert.equal((await call({ action: "remove", alias_id: aliasId })).body.ready, true);
assert.equal(writes, beforeApex, "Creating, renaming, or deleting apex aliases must never write or delete per-address routing rules");
assert.equal(lists, beforeApexLists, "Apex aliases must not scan hundreds of legacy rules");
catchAll.enabled = false;
assert.equal((await call({ action: "status", check_capacity: true, domain: "cspro.space" })).status, 409);
assert.equal((await call({ action: "ensure", alias_id: aliasId })).status, 409);
catchAll.enabled = true;
catchAll.actions = [{ type: "forward", value: ["other@example.com"] }];
assert.equal((await call({ action: "ensure", alias_id: aliasId })).status, 409, "A catch-all that forwards elsewhere must not be accepted");
aliases[0].domain = "beng.canvasphere.cyou";
const beforeCanvasphere = writes;
assert.match((await call({ action: "status", check_capacity: true, domain: "beng.canvasphere.cyou" })).body.error, /token must include canvasphere/);
canvasphereZone = { id: canvasphereZoneId, name: "canvasphere.cyou", status: "pending" };
assert.match((await call({ action: "ensure", alias_id: aliasId })).body.error, /awaiting Cloudflare activation/);
canvasphereZone.status = "active";
assert.match((await call({ action: "ensure", alias_id: aliasId })).body.error, /DNS.*pending/);
assert.equal(writes, beforeCanvasphere, "Unconfigured domains must not write routes or activate aliases");
mxRecords = [{ type: 15, data: "10 route1.mx.cloudflare.net." }];
const legacyRules = JSON.stringify(rules);
assert.equal((await call({ action: "status", check_capacity: true, domain: "beng.canvasphere.cyou" })).body.can_create, true);
assert.equal((await call({ action: "ensure", alias_id: aliasId })).body.ready, true);
assert.equal(writeZones.at(-1), canvasphereZoneId);
assert.equal(canvasphereRules[0].matchers[0].value, "anotherandom@beng.canvasphere.cyou");
assert.equal(JSON.stringify(rules), legacyRules, "The new domain must not change existing-zone rules");
const beforeRepeat = writes;
await call({ action: "ensure", alias_id: aliasId });
assert.equal(writes, beforeRepeat);
mxRecords = [];
assert.equal((await call({ action: "remove", alias_id: aliasId })).body.ready, true, "Removing a managed route must work even during DNS failure");
assert.equal(canvasphereRules.length, 0);
assert.equal(JSON.stringify(rules), legacyRules);
aliases[0].domain = "canvasphere.cyou";
assert.match((await call({ action: "status", check_capacity: true, domain: "canvasphere.cyou" })).body.error, /DNS.*pending/);
mxRecords = [{ type: 15, data: "10 route1.mx.cloudflare.net." }];
const beforeCanvasphereApex = writes;
const beforeCanvasphereApexLists = lists;
canvasphereRules = Array.from({ length: 200 }, (_, index) => ({ id: `canvasphere-full-${index}`, enabled: true, matchers: [{ type: "literal", field: "to", value: `other${index}@beng.canvasphere.cyou` }], actions: [{ type: "worker", value: ["batform-email-forwarder"] }] }));
assert.equal((await call({ action: "status", check_capacity: true, domain: "canvasphere.cyou" })).body.can_create, true, "Canvasphere root aliases use catch-all even when all literal slots are full");
assert.equal(catchAllReads.at(-1), canvasphereZoneId, "Canvasphere root must check its own zone's catch-all");
assert.equal((await call({ action: "ensure", alias_id: aliasId })).body.ready, true);
aliases[0].local_part = "canvasphererenamed";
assert.equal((await call({ action: "ensure", alias_id: aliasId })).body.ready, true);
assert.equal((await call({ action: "sync", offset: 0 }, "admin")).body.synced, 1);
assert.equal((await call({ action: "remove", alias_id: aliasId })).body.ready, true);
assert.equal(writes, beforeCanvasphereApex, "Root create, rename, sync and delete must never mutate per-address rules");
assert.equal(lists, beforeCanvasphereApexLists, "Root aliases must not enumerate literal routes");
assert.equal(canvasphereRules.length, 200);
canvasphereCatchAll.enabled = false;
assert.match((await call({ action: "ensure", alias_id: aliasId })).body.error, /activate the canvasphere.cyou catch-all/);
canvasphereCatchAll.enabled = true;
canvasphereCatchAll.actions = [{ type: "worker", value: ["unrelated-worker"] }];
assert.equal((await call({ action: "ensure", alias_id: aliasId })).status, 409);
canvasphereCatchAll.actions = [{ type: "worker", value: ["batform-email-forwarder"] }];
aliases.push({ id: "22222222-2222-4222-8222-222222222222", local_part: "bengmixed", domain: "beng.canvasphere.cyou", enabled: true, user_id: "owner" });
mxByDomain.set("beng.canvasphere.cyou", []);
const mixedSync = await call({ action: "sync", offset: 0 }, "admin");
assert.equal(mixedSync.body.synced, 1);
assert.equal(mixedSync.body.errors.length, 1);
assert.match(mixedSync.body.errors[0], /@beng.canvasphere.cyou.*DNS.*pending/, "A shared zone lookup must not skip the subdomain's own MX readiness check");
assert.equal(writes, beforeCanvasphereApex);
aliases.pop();
mxByDomain.clear();
canvasphereZone = null;
mxRecords = [];
assert.equal((await call({ action: "remove", alias_id: aliasId })).body.ready, true, "Deleting a root alias never requires DNS or removes the shared route");
assert.equal(writes, beforeCanvasphereApex);
assert.equal(JSON.stringify(rules), legacyRules);
assert.equal((await call({ action: "status", check_capacity: true, domain: "other.canvasphere.cyou" })).status, 400);
console.log("Cloudflare routing checks passed: auth, ownership, configuration authorization, provisioning, idempotency, rename, conflict protection, sync errors, pause, and managed deletion.");

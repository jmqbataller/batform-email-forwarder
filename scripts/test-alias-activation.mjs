import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";

const id = "11111111-1111-4111-8111-111111111111";
let now = Date.parse("2026-10-05T12:00:00Z");
let row;
let routingFails = false;
let activationWriteFails = false;
let connected = true;
let refreshed = false;
class Clock extends Date { static now() { return now; } }
const client = {
  auth: { async getUser() { return { data: { user: { id: "owner", email: "owner@example.com" } } }; } },
  async rpc() { return { data: true }; },
  from(table) {
    let operation;
    let values;
    const filters = [];
    const query = {
      insert(input) { operation = "insert"; values = input; return this; },
      update(input) { operation = "update"; values = input; return this; },
      select() { return this; },
      eq(key, value) { filters.push([key, value]); return this; },
      execute() {
        if (table === "user_subscriptions") return { data: { plan: "pro", status: "active" } };
        if (operation === "insert") row = { id, enabled: true, routing_ready_at: null, created_at: new Clock(now).toISOString(), ...values };
        if (operation === "update") {
          if (activationWriteFails && values.routing_ready_at) return { data: null, error: { message: "write failed" } };
          if (filters.some(([key, value]) => row[key] !== value)) return { data: null };
          Object.assign(row, values);
        }
        return { data: row };
      },
      async single() { return this.execute(); },
      async maybeSingle() { return this.execute(); },
      then(resolve, reject) { return Promise.resolve(this.execute()).then(resolve, reject); },
    };
    return query;
  },
};

function evaluate(path, dependencies = {}) {
  const code = ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Date: Clock, require: (name) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  } });
  return exports;
}
const activation = evaluate("src/lib/alias-activation.ts");
const actions = evaluate("src/app/dashboard/actions.ts", {
  "next/cache": { revalidatePath() { refreshed = true; } },
  "next/navigation": { redirect() { throw new Error("Unexpected redirect"); } },
  zod: { z },
  "@/lib/random": { randomToken: () => "random1234" },
  "@/lib/supabase/server": { createClient: async () => client },
  "@/lib/alias-activation": activation,
  "@/lib/cloudflare-routing": { async invokeRouting(_client, body) {
    if (body.action === "status") return { connected };
    assert.equal(row.enabled, true, "Only enabled aliases should be provisioned");
    assert.equal(row.routing_ready_at, null, "Copy must remain blocked while provisioning");
    now += 5000; // Setup must finish before the alias becomes usable.
    return routingFails ? { error: "Provider unavailable" } : { ready: true };
  } },
});
const empty = { status: "idle", message: "" };
const form = (values = {}) => { const data = new FormData(); Object.entries(values).forEach(([key, value]) => data.set(key, value)); return data; };

assert.equal((await actions.createAlias(empty, form())).status, "success");
assert.ok(refreshed);
assert.equal(Date.parse(row.routing_ready_at), now, "No artificial delay after successful provisioning");
assert.equal(activation.aliasActivation(true, row.routing_ready_at).ready, true);
assert.equal(activation.aliasActivation(true, null).ready, false);
assert.equal(activation.aliasActivation(true, "invalid").ready, false);
assert.equal(activation.aliasActivation(false, row.routing_ready_at).ready, false);
assert.equal(activation.aliasActivation(true, new Date(now + 120000).toISOString()).ready, true, "Previously provisioned aliases no longer wait on legacy deadlines");
const savedTimestamp = row.routing_ready_at;
assert.equal(activation.aliasActivation(true, savedTimestamp).label, "Active", "Reloads preserve readiness");

routingFails = true;
assert.equal((await actions.createAlias(empty, form())).status, "error");
assert.equal(row.enabled, false);
assert.equal(row.routing_ready_at, null);
await assert.rejects(() => actions.toggleAlias(form({ id, enabled: "false" })), /Provider unavailable/);
assert.equal(row.enabled, false, "Failed re-enabling must return the alias to paused");

routingFails = false;
await actions.toggleAlias(form({ id, enabled: "false" }));
assert.equal(row.enabled, true);
assert.equal(Date.parse(row.routing_ready_at), now);
routingFails = true;
assert.equal((await actions.renameAliasAddress(form({ id, local_part: "renamed123" }))).status, "error");
assert.equal(row.enabled, false, "A failed address change must not appear active");

routingFails = false;
activationWriteFails = true;
assert.equal((await actions.createAlias(empty, form())).status, "error");
assert.equal(row.enabled, false, "A database activation write failure must also pause the alias");
connected = false;
const prior = row;
assert.equal((await actions.createAlias(empty, form())).status, "error");
assert.equal(row, prior, "Disconnected routing must not create an alias");
console.log("Alias activation checks passed: immediate post-provisioning availability, legacy waits removed, reload, pause, provider failure, re-enable, rename, database failure, and disconnected routing.");

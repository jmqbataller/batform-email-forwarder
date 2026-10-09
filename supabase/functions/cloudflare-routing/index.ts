import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { z } from "npm:zod@4.1.0";
import { aliasDomains, canvasphereDomain, capacityMessage, catchAllReady, domain, hasRoutingCapacity, primaryDomain, ruleBody, ruleForAddress, routesToWorker, zoneNameFor, type RoutingRule } from "./rules.ts";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("connect"), token: z.string().trim().min(20).max(500) }),
  z.object({ action: z.literal("status"), check_capacity: z.boolean().default(false), domain: z.enum(aliasDomains).default(domain) }),
  z.object({ action: z.literal("sync"), offset: z.number().int().min(0).max(100000).default(0) }),
  z.object({ action: z.literal("ensure"), alias_id: z.uuid() }),
  z.object({ action: z.literal("remove"), alias_id: z.uuid() }),
]);

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}

class RoutingError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}

async function cloudflare<T>(token: string, path: string, method = "GET", body?: unknown): Promise<{ result: T; result_info?: { total_pages?: number; total_count?: number; per_page?: number } }> {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    // Provider errors can contain submitted data. Never return or log them with credentials.
    if (Array.isArray(data.errors) && data.errors.some((error: { code?: number }) => error.code === 2018)) {
      throw new RoutingError(capacityMessage, 409);
    }
    throw new RoutingError(response.status === 429
      ? "Email routing is temporarily busy. Please retry later."
      : response.status === 401 || response.status === 403
        ? "Cloudflare denied access. Check the token permissions and zone scope."
        : "Cloudflare could not save the routing rule. Check Email Routing is enabled and the routing rule limit has not been reached.");
  }
  return data;
}

async function listRules(token: string, zone: string) {
  const rules: RoutingRule[] = [];
  for (let page = 1; page <= 20; page++) {
    const data = await cloudflare<RoutingRule[]>(token, `/zones/${zone}/email/routing/rules?per_page=50&page=${page}`);
    rules.push(...data.result);
    const info = data.result_info;
    const totalPages = info?.total_pages ?? (info?.total_count === undefined
      ? null
      : Math.ceil(info.total_count / (info.per_page || 50)));
    if (totalPages !== null ? page >= totalPages : data.result.length < 50) return rules;
  }
  throw new RoutingError("Too many Cloudflare routing rules to reconcile safely.");
}

async function ensureRule(token: string, zone: string, rules: RoutingRule[], alias: { id: string; local_part: string; domain?: string }) {
  const body = ruleBody(alias);
  const existing = ruleForAddress(rules, `${alias.local_part}@${alias.domain || domain}`);
  const managed = rules.find((rule) => rule.name === body.name);
  if (existing && existing.id !== managed?.id) {
    if (routesToWorker(existing)) return;
    throw new RoutingError("An existing Cloudflare rule uses this address. Review that rule before syncing.", 409);
  }
  if (managed && routesToWorker(managed) && managed.matchers[0]?.value === body.matchers[0].value) return;
  if (!managed && !hasRoutingCapacity(rules)) throw new RoutingError(capacityMessage, 409);
  const data = await cloudflare<RoutingRule>(token, `/zones/${zone}/email/routing/rules${managed ? `/${managed.id}` : ""}`, managed ? "PUT" : "POST", body);
  if (managed) rules.splice(rules.indexOf(managed), 1);
  rules.push(data.result);
}

async function requireCatchAll(token: string, zone: string) {
  const { result } = await cloudflare<RoutingRule>(token, `/zones/${zone}/email/routing/rules/catch_all`);
  if (!catchAllReady(result)) throw new RoutingError("An admin must activate the cspro.space catch-all for the BatMail Worker before using new aliases.", 409);
}

async function requireCanvasphereMx() {
  const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${canvasphereDomain}&type=MX`, {
    headers: { Accept: "application/dns-json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new RoutingError("Could not verify the new domain's mail records. Please retry.");
  const dns = await response.json();
  const records = (dns.Answer || []).filter((record: { type: number }) => record.type === 15);
  if (dns.Status !== 0 || !records.length || !records.every((record: { data: string }) => /^\d+\s+[^\s]+\.mx\.cloudflare\.net\.?$/i.test(record.data))) {
    throw new RoutingError(`Email Routing DNS for @${canvasphereDomain} is still pending. Enable the beng subdomain in Cloudflare before creating aliases.`, 409);
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const authorization = request.headers.get("Authorization") || "";
    const jwt = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!jwt) return json({ error: "Unauthorized" }, 401);
    const { data: { user }, error: authError } = await admin.auth.getUser(jwt);
    if (authError || !user) return json({ error: "Unauthorized" }, 401);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return json({ error: "Invalid request" }, 400);
    const input = parsed.data;
    if (input.action === "connect" || input.action === "sync") {
      const scoped = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: isAdmin, error } = await scoped.rpc("is_subscription_admin");
      if (error || isAdmin !== true) return json({ error: "Admin access required" }, 403);
    }
    async function secret(name: string) {
      const { data, error } = await admin.rpc("get_batmail_secret", { secret_name: name });
      if (error) throw new Error("Secret lookup failed");
      return data as string | null;
    }
    if (input.action === "connect") {
      const zones = await cloudflare<{ id: string; name: string }[]>(input.token, "/zones?name=cspro.space&status=active");
      const zone = zones.result.find((item) => item.name === "cspro.space");
      if (!zone) throw new RoutingError("The token must include the active cspro.space zone.", 400);
      await listRules(input.token, zone.id);
      const { error } = await admin.rpc("set_batmail_cloudflare_configuration", { api_token: input.token, zone_id: zone.id });
      if (error) throw new Error("Configuration save failed");
      return json({ connected: true });
    }
    const [token, zone] = await Promise.all([secret("batmail_cloudflare_api_token"), secret("batmail_cloudflare_zone_id")]);
    const zones = new Map<string, string>();
    async function zoneFor(aliasDomain: string, requireReady = true) {
      const zoneName = zoneNameFor(aliasDomain);
      if (zoneName === primaryDomain) return zone!;
      const cached = zones.get(zoneName);
      if (cached) return cached;
      const { result } = await cloudflare<{ id: string; name: string; status: string }[]>(token!, `/zones?name=${zoneName}`);
      const found = result.find((item) => item.name === zoneName);
      if (!found) throw new RoutingError(`The Cloudflare token must include ${zoneName}. Ask an admin to update the connection with access to both zones.`, 409);
      if (requireReady) {
        if (found.status !== "active") throw new RoutingError(`${zoneName} is awaiting Cloudflare activation. Retry when its nameservers are active.`, 409);
        await requireCanvasphereMx();
      }
      zones.set(zoneName, found.id);
      return found.id;
    }
    if (input.action === "status") {
      const connected = Boolean(token && zone);
      if (!connected || !input.check_capacity) return json({ connected });
      if (input.domain === primaryDomain) {
        await requireCatchAll(token!, zone!);
        return json({ connected, can_create: true });
      }
      const can_create = hasRoutingCapacity(await listRules(token!, await zoneFor(input.domain)));
      return json({ connected, can_create, ...(can_create ? {} : { error: capacityMessage }) });
    }
    if (!token || !zone) return json({ error: "Connect Cloudflare in the admin dashboard before using new aliases." }, 409);
    if (input.action === "sync") {
      const { data: aliases, error } = await admin.from("aliases").select("id,local_part,domain").eq("enabled", true).order("created_at", { ascending: false }).order("id").range(input.offset, input.offset + 19);
      if (error) throw new Error("Alias lookup failed");
      const rulesByZone = new Map<string, RoutingRule[]>();
      let apexReady = false;
      const errors: string[] = [];
      let synced = 0;
      for (const alias of aliases || []) {
        try {
          if (alias.domain === primaryDomain) {
            if (!apexReady) { await requireCatchAll(token, zone); apexReady = true; }
          } else {
            const aliasZone = await zoneFor(alias.domain || domain);
            let rules = rulesByZone.get(aliasZone);
            if (!rules) { rules = await listRules(token, aliasZone); rulesByZone.set(aliasZone, rules); }
            await ensureRule(token, aliasZone, rules, alias);
          }
          const { error: activationError } = await admin.from("aliases").update({ routing_ready_at: new Date().toISOString() }).eq("id", alias.id);
          if (activationError) throw new Error("Activation update failed");
          synced++;
        }
        catch (error) { errors.push(`${alias.local_part}@${alias.domain || domain}: ${error instanceof RoutingError ? error.message : "Routing failed; retry sync."}`); }
      }
      return json({ synced, errors, next_offset: aliases?.length === 20 ? input.offset + 20 : null });
    }
    const { data: alias, error } = await admin.from("aliases").select("id,local_part,domain,enabled").eq("id", input.alias_id).eq("user_id", user.id).maybeSingle();
    if (error) throw new Error("Alias lookup failed");
    if (!alias) return json({ error: "Alias not found" }, 404);
    if (alias.domain === primaryDomain) {
      if (input.action === "ensure") {
        if (!alias.enabled) return json({ error: "Enable this alias before syncing." }, 409);
        await requireCatchAll(token, zone);
      }
      // Apex aliases share one route. Deleting an alias must never remove it.
      return json({ ready: true });
    }
    const aliasZone = await zoneFor(alias.domain || domain, input.action !== "remove");
    const rules = await listRules(token, aliasZone);
    if (input.action === "remove") {
      // Only remove rules created by this integration, never unrelated/manual routing rules.
      for (const rule of rules.filter((item) => item.name === `BatMail/${alias.id}`)) {
        await cloudflare(token, `/zones/${aliasZone}/email/routing/rules/${rule.id}`, "DELETE");
      }
    } else {
      if (!alias.enabled) return json({ error: "Enable this alias before syncing." }, 409);
      await ensureRule(token, aliasZone, rules, alias);
    }
    return json({ ready: true });
  } catch (error) {
    if (error instanceof RoutingError) return json({ error: error.message }, error.status);
    return json({ error: "Routing connection failed. Please retry." }, 500);
  }
});

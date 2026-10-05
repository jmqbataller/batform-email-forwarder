"use server";

import { createClient } from "@/lib/supabase/server";
import { invokeRouting, type RoutingResult } from "@/lib/cloudflare-routing";

async function adminClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: isAdmin } = await supabase.rpc("is_subscription_admin");
  return isAdmin === true ? supabase : null;
}

export async function connectCloudflare(formData: FormData): Promise<RoutingResult> {
  const supabase = await adminClient();
  if (!supabase) return { error: "Admin access required." };
  const token = String(formData.get("token") || "").trim();
  if (token.length < 20 || token.length > 500) return { error: "Enter a valid Cloudflare API token." };
  return invokeRouting(supabase, { action: "connect", token });
}

export async function syncCloudflare(offset: number): Promise<RoutingResult> {
  const supabase = await adminClient();
  if (!supabase) return { error: "Admin access required." };
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) return { error: "Invalid sync offset." };
  return invokeRouting(supabase, { action: "sync", offset });
}

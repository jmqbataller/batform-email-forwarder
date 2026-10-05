"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { randomToken } from "@/lib/random";
import { createClient } from "@/lib/supabase/server";
import { invokeRouting } from "@/lib/cloudflare-routing";
import { forwardingDomain } from "@/lib/config";

export type AliasActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const PAID_PLANS = new Set(["starter", "pro", "business"]);
const EDIT_WINDOW_MS = 3 * 60 * 1000;

function refreshAliasViews() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/aliases");
  revalidatePath("/dashboard/inbox");
  revalidatePath("/dashboard/subscription");
}

async function activateAlias(supabase: Awaited<ReturnType<typeof createClient>>, aliasId: string, userId: string) {
  const route = await invokeRouting(supabase, { action: "ensure", alias_id: aliasId });
  if (route.ready) {
    const { data, error } = await supabase.from("aliases").update({
      routing_ready_at: new Date(Date.now()).toISOString(),
    }).eq("id", aliasId).eq("user_id", userId).eq("enabled", true).select("id").maybeSingle();
    if (!error && data) return { ready: true };
  }
  const { error } = await supabase.from("aliases").update({ enabled: false, routing_ready_at: null }).eq("id", aliasId).eq("user_id", userId);
  return { ready: false, error: error ? "Could not finish activation. Reload and pause this alias before retrying." : route.error || "Activation failed. Enable the paused alias to retry." };
}

async function getAliasMutationAccess(aliasId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: alias }, { data: subscription }, { data: isAdmin }] = await Promise.all([
    supabase.from("aliases").select("id,user_id,created_at").eq("id", aliasId).eq("user_id", user.id).maybeSingle(),
    supabase.from("user_subscriptions").select("plan,status").eq("user_id", user.id).maybeSingle(),
    supabase.rpc("is_subscription_admin"),
  ]);

  const paid = Boolean(subscription && PAID_PLANS.has(subscription.plan) && ["active", "trialing"].includes(subscription.status));
  const withinWindow = Boolean(alias && Date.now() < new Date(alias.created_at).getTime() + EDIT_WINDOW_MS);
  const admin = Boolean(isAdmin);

  return { supabase, user, alias, paid, withinWindow, admin, allowed: Boolean(alias && (admin || (paid && withinWindow))) };
}

function lockedMessage(paid: boolean, withinWindow: boolean) {
  if (!paid) return "Editing and deleting aliases are available on Starter, Pro, and Business plans.";
  if (!withinWindow) return "This alias is locked. Paid plans can edit or delete an alias only within 3 minutes of creation.";
  return "This alias cannot be changed.";
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createAlias(_state: AliasActionState, formData: FormData): Promise<AliasActionState> {
  const labelResult = z.string().trim().max(60).safeParse(formData.get("label") || "");
  if (!labelResult.success) return { status: "error", message: "The label must be 60 characters or fewer." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");
  const routing = await invokeRouting(supabase, { action: "status", check_capacity: true, domain: forwardingDomain });
  if (!routing.connected) return { status: "error", message: routing.error || "An admin must connect Cloudflare before creating new aliases." };
  if (routing.can_create !== true) return { status: "error", message: routing.error || "Could not verify email routing capacity. Please try again." };

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data: alias, error } = await supabase.from("aliases").insert({
      user_id: user.id,
      local_part: randomToken(10),
      domain: forwardingDomain,
      destination: user.email.toLowerCase(),
      label: labelResult.data || null,
    }).select("id").single();
    if (!error) {
      const route = await activateAlias(supabase, alias.id, user.id);
      refreshAliasViews();
      if (!route.ready) return { status: "error", message: `Alias activation failed. ${route.error}` };
      return { status: "success", message: "Alias created. Email routing is set up; you can copy and use your address now." };
    }
    if (error.message?.includes("ALIAS_QUOTA_REACHED")) {
      return { status: "error", message: "You reached your plan's alias limit. Upgrade your subscription to create more aliases." };
    }
    if (error.code !== "23505" || attempt === 3) return { status: "error", message: "Could not create an alias. Please try again." };
  }

  return { status: "error", message: "Could not create an alias. Please try again." };
}

export async function toggleAlias(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("id"));
  const enabled = z.enum(["true", "false"]).safeParse(formData.get("enabled"));
  if (!id.success || !enabled.success) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.from("aliases").update({ enabled: enabled.data !== "true", routing_ready_at: null }).eq("id", id.data).eq("user_id", user.id);
  if (error) throw error;
  if (enabled.data !== "true") {
    const route = await activateAlias(supabase, id.data, user.id);
    refreshAliasViews();
    if (!route.ready) throw new Error(route.error);
  } else {
    refreshAliasViews();
  }
}

export async function renameAlias(formData: FormData): Promise<AliasActionState> {
  const id = z.uuid().safeParse(formData.get("id"));
  const label = z.string().trim().min(1).max(60).safeParse(formData.get("label"));
  if (!id.success || !label.success) return { status: "error", message: "Enter a label between 1 and 60 characters." };

  const access = await getAliasMutationAccess(id.data);
  if (!access.allowed) return { status: "error", message: lockedMessage(access.paid, access.withinWindow) };

  const { error } = await access.supabase.from("aliases").update({ label: label.data }).eq("id", id.data).eq("user_id", access.user.id);
  if (error) return { status: "error", message: error.message.includes("ALIAS_EDIT_LOCKED") ? lockedMessage(access.paid, false) : "Could not update the label. Please try again." };

  refreshAliasViews();
  return { status: "success", message: "Label updated." };
}

export async function renameAliasAddress(formData: FormData): Promise<AliasActionState> {
  const id = z.uuid().safeParse(formData.get("id"));
  const localPart = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9._-]{5,47}$/, "Use 6–48 lowercase letters, numbers, dots, underscores, or hyphens.").safeParse(formData.get("local_part"));
  if (!id.success || !localPart.success) return { status: "error", message: localPart.success ? "Invalid alias." : localPart.error.issues[0]?.message || "Invalid alias." };

  const access = await getAliasMutationAccess(id.data);
  if (!access.allowed) return { status: "error", message: lockedMessage(access.paid, access.withinWindow) };

  const { error } = await access.supabase.from("aliases").update({ local_part: localPart.data, routing_ready_at: null }).eq("id", id.data).eq("user_id", access.user.id);
  if (error) {
    if (error.code === "23505") return { status: "error", message: "That alias address is already in use." };
    return { status: "error", message: error.message.includes("ALIAS_EDIT_LOCKED") ? lockedMessage(access.paid, false) : "Could not update the alias address. Please try again." };
  }

  const route = await activateAlias(access.supabase, id.data, access.user.id);
  refreshAliasViews();
  if (!route.ready) return { status: "error", message: `Address saved. ${route.error}` };
  return { status: "success", message: "Address updated. Email routing is set up; you can use it now." };
}

export async function deleteAlias(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const access = await getAliasMutationAccess(id.data);
  if (!access.allowed) return;

  const route = await invokeRouting(access.supabase, { action: "remove", alias_id: id.data });
  if (route.error) throw new Error(route.error);

  const { error } = await access.supabase.from("aliases").delete().eq("id", id.data).eq("user_id", access.user.id);
  if (error) return;

  refreshAliasViews();
}

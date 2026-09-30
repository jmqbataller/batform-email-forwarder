"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { randomToken } from "@/lib/random";
import { createClient } from "@/lib/supabase/server";

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

async function getAliasMutationAccess(aliasId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: alias }, { data: subscription }] = await Promise.all([
    supabase.from("aliases").select("id,user_id,created_at").eq("id", aliasId).eq("user_id", user.id).maybeSingle(),
    supabase.from("user_subscriptions").select("plan,status").eq("user_id", user.id).maybeSingle(),
  ]);

  const paid = Boolean(subscription && PAID_PLANS.has(subscription.plan) && ["active", "trialing"].includes(subscription.status));
  const withinWindow = Boolean(alias && Date.now() < new Date(alias.created_at).getTime() + EDIT_WINDOW_MS);

  return { supabase, user, alias, paid, withinWindow, allowed: Boolean(alias && paid && withinWindow) };
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

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { error } = await supabase.from("aliases").insert({
      user_id: user.id,
      local_part: randomToken(10),
      destination: user.email.toLowerCase(),
      label: labelResult.data || null,
    });
    if (!error) {
      refreshAliasViews();
      return { status: "success", message: "Alias created and ready to receive mail." };
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
  const { error } = await supabase.from("aliases").update({ enabled: enabled.data !== "true" }).eq("id", id.data).eq("user_id", user.id);
  if (error) throw error;
  refreshAliasViews();
}

export async function renameAlias(formData: FormData): Promise<AliasActionState> {
  const id = z.uuid().safeParse(formData.get("id"));
  const label = z.string().trim().min(1).max(60).safeParse(formData.get("label"));
  if (!id.success || !label.success) return { status: "error", message: "Enter a label between 1 and 60 characters." };

  const access = await getAliasMutationAccess(id.data);
  if (!access.allowed) return { status: "error", message: lockedMessage(access.paid, access.withinWindow) };

  const { error } = await access.supabase
    .from("aliases")
    .update({ label: label.data })
    .eq("id", id.data)
    .eq("user_id", access.user.id);
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

  const { error } = await access.supabase
    .from("aliases")
    .update({ local_part: localPart.data })
    .eq("id", id.data)
    .eq("user_id", access.user.id);
  if (error) {
    if (error.code === "23505") return { status: "error", message: "That alias address is already in use." };
    return { status: "error", message: error.message.includes("ALIAS_EDIT_LOCKED") ? lockedMessage(access.paid, false) : "Could not update the alias address. Please try again." };
  }

  refreshAliasViews();
  return { status: "success", message: "Alias address updated." };
}

export async function deleteAlias(formData: FormData): Promise<void> {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const access = await getAliasMutationAccess(id.data);
  if (!access.allowed) return;

  const { error } = await access.supabase.from("aliases").delete().eq("id", id.data).eq("user_id", access.user.id);
  if (error) return;

  refreshAliasViews();
}

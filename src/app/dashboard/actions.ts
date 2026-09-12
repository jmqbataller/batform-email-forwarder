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

function refreshAliasViews() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/aliases");
  revalidatePath("/dashboard/inbox");
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
  const { error } = await supabase.from("aliases").update({ enabled: enabled.data !== "true" }).eq("id", id.data);
  if (error) throw error;
  refreshAliasViews();
}

export async function renameAlias(formData: FormData): Promise<AliasActionState> {
  const id = z.uuid().safeParse(formData.get("id"));
  const label = z.string().trim().min(1).max(60).safeParse(formData.get("label"));
  if (!id.success || !label.success) return { status: "error", message: "Enter a label between 1 and 60 characters." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase
    .from("aliases")
    .update({ label: label.data })
    .eq("id", id.data)
    .eq("user_id", user.id);
  if (error) return { status: "error", message: "Could not update the label. Please try again." };

  refreshAliasViews();
  return { status: "success", message: "Label updated." };
}

export async function deleteAlias(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.from("aliases").delete().eq("id", id.data);
  if (error) throw error;
  refreshAliasViews();
}

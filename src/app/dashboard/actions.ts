"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { randomToken } from "@/lib/random";
import { createClient } from "@/lib/supabase/server";

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createAlias(formData: FormData) {
  const labelResult = z.string().trim().max(60).safeParse(formData.get("label") || "");
  if (!labelResult.success) return;
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
    if (!error) break;
    if (error.code !== "23505" || attempt === 3) throw error;
  }
  revalidatePath("/dashboard");
}

export async function toggleAlias(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("id"));
  const enabled = z.enum(["true", "false"]).safeParse(formData.get("enabled"));
  if (!id.success || !enabled.success) return;
  const supabase = await createClient();
  const { error } = await supabase.from("aliases").update({ enabled: enabled.data !== "true" }).eq("id", id.data);
  if (error) throw error;
  revalidatePath("/dashboard");
}

export async function deleteAlias(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  const { error } = await supabase.from("aliases").delete().eq("id", id.data);
  if (error) throw error;
  revalidatePath("/dashboard");
}

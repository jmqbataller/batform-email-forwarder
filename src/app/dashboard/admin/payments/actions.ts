"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export async function reviewPayment(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("id"));
  const status = z.enum(["approved", "rejected"]).safeParse(formData.get("status"));
  const note = z.string().trim().max(500).safeParse(formData.get("note") || "");
  if (!id.success || !status.success || !note.success) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: isAdmin } = await supabase.rpc("is_subscription_admin");
  if (!isAdmin) redirect("/dashboard");

  const { error } = await supabase
    .from("payment_submissions")
    .update({ status: status.data, admin_note: note.data || null })
    .eq("id", id.data)
    .eq("status", "pending");

  if (error) throw error;

  revalidatePath("/dashboard/admin/payments");
  revalidatePath("/dashboard/subscription");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function manageCustomerSubscription(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: isAdmin } = await supabase.rpc("is_subscription_admin");
  if (!isAdmin) redirect("/dashboard");

  const userId = String(formData.get("user_id") || "");
  const action = String(formData.get("action") || "");
  const planValue = String(formData.get("plan") || "");
  const daysValue = Number(formData.get("days") || 30);

  if (!userId || !["activate", "renew", "revoke"].includes(action)) {
    throw new Error("Invalid admin subscription action.");
  }

  const plan = ["starter", "pro", "business"].includes(planValue) ? planValue : null;
  const days = Number.isFinite(daysValue) ? Math.min(Math.max(Math.trunc(daysValue), 1), 3650) : 30;

  const { error } = await supabase.rpc("admin_manage_subscription", {
    p_user_id: userId,
    p_action: action,
    p_plan: plan,
    p_days: days,
  });

  if (error) {
    throw new Error(error.message || "Unable to update customer subscription.");
  }

  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/subscription");
}
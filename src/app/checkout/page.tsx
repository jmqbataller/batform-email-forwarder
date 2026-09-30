import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { createClient } from "@/lib/supabase/server";
import { CheckoutForm } from "./checkout-form";
import styles from "./checkout.module.css";

export const metadata = { title: "Checkout" };

const paidPlans = new Set(["starter", "pro", "business"]);

type PaidPlan = "starter" | "pro" | "business";

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const params = await searchParams;
  const selectedPlan = paidPlans.has(params.plan || "") ? (params.plan as PaidPlan) : "starter";
  const nextPath = `/checkout?plan=${selectedPlan}`;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?mode=signup&next=${encodeURIComponent(nextPath)}`);

  const { data: latestPayment } = await supabase
    .from("payment_submissions")
    .select("requested_plan,status")
    .eq("user_id", user.id)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topbar}>
          <Link href="/"><Logo /></Link>
          <Link className={styles.back} href="/dashboard/subscription">Back to subscription</Link>
        </div>
        <div className={styles.heading}>
          <div className={styles.eyebrow}>Secure manual checkout</div>
          <h1>Upgrade your BatMail plan.</h1>
          <p>Pay with GCash and submit your receipt for review. Your current plan remains active until your payment is approved.</p>
        </div>
        <CheckoutForm userId={user.id} initialPlan={selectedPlan} pendingPlan={latestPayment?.requested_plan} pendingStatus={latestPayment?.status} />
      </div>
    </main>
  );
}

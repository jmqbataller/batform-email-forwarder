import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Subscription" };

const planLimits: Record<string, number> = {
  free: 3,
  starter: 20,
  pro: 100,
  business: 1000,
};

const plans = [
  { name: "Free", key: "free", limit: 3, price: "₱0", description: "For trying BatMail and protecting a few important accounts." },
  { name: "Starter", key: "starter", limit: 20, price: "₱149", description: "For everyday accounts, shopping, newsletters, and signups." },
  { name: "Pro", key: "pro", limit: 100, price: "₱349", description: "For power users managing many private email identities." },
  { name: "Business", key: "business", limit: 1000, price: "₱749", description: "For teams and higher-volume alias management." },
] as const;

export default async function SubscriptionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: subscription }, { count: aliasCount }, { data: latestPayment }] = await Promise.all([
    supabase.from("user_subscriptions").select("plan,status,current_period_end,provider").eq("user_id", user.id).maybeSingle(),
    supabase.from("aliases").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("payment_submissions").select("requested_plan,status,submitted_at,admin_note").eq("user_id", user.id).order("submitted_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const currentPlan = subscription?.plan || "free";
  const currentStatus = subscription?.status || "active";
  const limit = planLimits[currentPlan] || 3;
  const used = aliasCount || 0;

  return (
    <div className="dashboard">
      <div className="page-head">
        <div>
          <span className="page-kicker">Subscription</span>
          <h1>Your plan</h1>
          <p>Review your current plan, usage, renewal, and payment approval status.</p>
        </div>
        <Link className="button button-primary" href="/checkout?plan=starter">Upgrade plan</Link>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-top"><span>Current plan</span></div><strong className="stat-value">{currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}</strong><span className="stat-note">Status: {currentStatus}</span></div>
        <div className="stat-card"><div className="stat-top"><span>Alias usage</span></div><strong className="stat-value">{used} / {limit}</strong><span className="stat-note">Aliases used on this plan</span></div>
        <div className="stat-card"><div className="stat-top"><span>Renewal</span></div><strong className="stat-value">{subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString("en-PH") : "—"}</strong><span className="stat-note">{subscription?.provider === "manual_gcash" ? "Manual GCash subscription" : "No paid billing yet"}</span></div>
      </div>

      {latestPayment ? (
        <section className="panel">
          <div className="panel-head">
            <div><h2>Latest payment request</h2><p>{new Date(latestPayment.submitted_at).toLocaleString("en-PH")}</p></div>
            <span>{latestPayment.status}</span>
          </div>
          <p>Requested plan: <strong>{latestPayment.requested_plan.charAt(0).toUpperCase() + latestPayment.requested_plan.slice(1)}</strong></p>
          {latestPayment.status === "pending" ? <p>Your current plan remains unchanged until the payment is approved.</p> : null}
          {latestPayment.admin_note ? <p>Admin note: {latestPayment.admin_note}</p> : null}
          {latestPayment.status !== "pending" ? <Link className="button button-primary" href={`/checkout?plan=${latestPayment.requested_plan}`}>Open checkout</Link> : null}
        </section>
      ) : null}

      <section className="panel" aria-labelledby="plans-heading">
        <div className="panel-head"><div><h2 id="plans-heading">Available plans</h2><p>Monthly Philippine Peso pricing.</p></div></div>
        <div className="stats-grid">
          {plans.map((plan) => (
            <div className="stat-card" key={plan.key}>
              <div className="stat-top"><span>{plan.name}</span></div>
              <strong className="stat-value">{plan.price}</strong>
              <span className="stat-note">per month · {plan.limit.toLocaleString()} aliases</span>
              <p>{plan.description}</p>
              {currentPlan === plan.key ? (
                <span className="stat-note">Current plan</span>
              ) : plan.key === "free" ? (
                <span className="stat-note">Included by default</span>
              ) : (
                <Link className="button button-ghost" href={`/checkout?plan=${plan.key}`}>Choose {plan.name}</Link>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

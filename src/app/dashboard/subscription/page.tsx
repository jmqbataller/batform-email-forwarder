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
  { name: "Free", key: "free", limit: 3, description: "For trying BatMail and protecting a few important accounts." },
  { name: "Starter", key: "starter", limit: 20, description: "For everyday accounts, shopping, newsletters, and signups." },
  { name: "Pro", key: "pro", limit: 100, description: "For power users managing many private email identities." },
  { name: "Business", key: "business", limit: 1000, description: "For teams and higher-volume alias management." },
] as const;

export default async function SubscriptionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: subscription }, { count: aliasCount }] = await Promise.all([
    supabase.from("user_subscriptions").select("plan,status,current_period_end").eq("user_id", user.id).maybeSingle(),
    supabase.from("aliases").select("id", { count: "exact", head: true }).eq("user_id", user.id),
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
          <p>Manage your alias allowance and subscription status.</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-top"><span>Current plan</span></div><strong className="stat-value">{currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}</strong><span className="stat-note">Status: {currentStatus}</span></div>
        <div className="stat-card"><div className="stat-top"><span>Alias usage</span></div><strong className="stat-value">{used} / {limit}</strong><span className="stat-note">Aliases used on this plan</span></div>
        <div className="stat-card"><div className="stat-top"><span>Renewal</span></div><strong className="stat-value">{subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString("en-US") : "—"}</strong><span className="stat-note">Paid billing activates after checkout is connected</span></div>
      </div>

      <section className="panel" aria-labelledby="plans-heading">
        <div className="panel-head"><div><h2 id="plans-heading">Available plans</h2><p>Database-enforced limits are already active.</p></div></div>
        <div className="stats-grid">
          {plans.map((plan) => (
            <div className="stat-card" key={plan.key}>
              <div className="stat-top"><span>{plan.name}</span></div>
              <strong className="stat-value">{plan.limit}</strong>
              <span className="stat-note">aliases</span>
              <p>{plan.description}</p>
              <span className="stat-note">{currentPlan === plan.key ? "Current plan" : plan.key === "free" ? "Included" : "Checkout connection pending"}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

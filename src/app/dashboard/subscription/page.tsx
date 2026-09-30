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
  {
    name: "Free",
    key: "free",
    limit: 3,
    price: "₱0",
    description: "A simple starting point for protecting a few important accounts.",
    features: ["3 private aliases", "Private forwarding", "Pause aliases anytime"],
  },
  {
    name: "Starter",
    key: "starter",
    limit: 20,
    price: "₱149",
    description: "For everyday shopping, apps, newsletters, and personal signups.",
    features: ["20 private aliases", "Edit/delete within 3 minutes", "Everything in Free"],
  },
  {
    name: "Pro",
    key: "pro",
    limit: 100,
    price: "₱349",
    description: "For power users managing a larger set of private identities.",
    features: ["100 private aliases", "Everything in Starter", "Higher usage capacity"],
  },
  {
    name: "Business",
    key: "business",
    limit: 1000,
    price: "₱749",
    description: "For teams and workflows that need much more alias capacity.",
    features: ["1,000 private aliases", "Everything in Pro", "Business-scale capacity"],
  },
] as const;

export default async function SubscriptionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: subscription }, { count: aliasCount }, { data: latestPayment }, { data: isAdmin }] = await Promise.all([
    supabase.from("user_subscriptions").select("plan,status,current_period_end,provider").eq("user_id", user.id).maybeSingle(),
    supabase.from("aliases").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("payment_submissions").select("requested_plan,status,submitted_at,admin_note").eq("user_id", user.id).order("submitted_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.rpc("is_subscription_admin"),
  ]);

  const admin = Boolean(isAdmin);
  const currentPlan = subscription?.plan || "free";
  const currentStatus = subscription?.status || "active";
  const limit = planLimits[currentPlan] || 3;
  const used = aliasCount || 0;
  const usagePercent = admin ? 100 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  const planLabel = admin ? "Admin" : currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1);
  const renewalLabel = admin
    ? "No renewal required"
    : subscription?.current_period_end
      ? new Date(subscription.current_period_end).toLocaleDateString("en-PH")
      : currentPlan === "free"
        ? "No renewal"
        : "Not scheduled";

  return (
    <div className="dashboard">
      <div className="page-head">
        <div>
          <span className="page-kicker">Subscription</span>
          <h1>Plan & billing</h1>
          <p>See your current access, alias usage, payment status, and available plans in one place.</p>
        </div>
        {!admin ? <Link className="button button-primary" href="#plans">{currentPlan === "free" ? "Upgrade plan" : "Change plan"}</Link> : null}
      </div>

      <section className="subscription-overview" aria-label="Current subscription summary">
        <div className="subscription-hero">
          <span className="subscription-label">Current plan</span>
          <h2>{planLabel}</h2>
          <p>{admin ? "Unrestricted administrator access with no alias cap or subscription renewal requirement." : `Your ${planLabel} plan is currently ${currentStatus}. Manage your capacity or choose another plan below.`}</p>
          <div className="subscription-meta">
            <span>Status<strong>{admin ? "Unrestricted" : currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1)}</strong></span>
            <span>Renewal<strong>{renewalLabel}</strong></span>
            <span>Billing<strong>{admin ? "Admin access" : subscription?.provider === "manual_gcash" ? "Manual GCash" : currentPlan === "free" ? "Free" : "Manual"}</strong></span>
          </div>
        </div>

        <div className="usage-card">
          <span>Alias usage</span>
          <strong>{admin ? `${used} / Unlimited` : `${used} / ${limit.toLocaleString()}`}</strong>
          <p>{admin ? "No alias limit applies to administrator accounts." : `${Math.max(limit - used, 0).toLocaleString()} aliases remaining on this plan.`}</p>
          <div className="usage-track" aria-hidden="true"><i style={{ width: `${usagePercent}%` }} /></div>
          <p>{admin ? "Unlimited capacity" : `${usagePercent}% of plan capacity used`}</p>
        </div>
      </section>

      {!admin && latestPayment ? (
        <section className="payment-status-card" aria-label="Latest payment request">
          <div>
            <h3>{latestPayment.status === "pending" ? "Payment awaiting review" : "Latest payment request"}</h3>
            <p>
              {latestPayment.requested_plan.charAt(0).toUpperCase() + latestPayment.requested_plan.slice(1)} plan · submitted {new Date(latestPayment.submitted_at).toLocaleString("en-PH")}
              {latestPayment.admin_note ? ` · ${latestPayment.admin_note}` : ""}
            </p>
          </div>
          <span className={`status-badge ${latestPayment.status}`}>{latestPayment.status}</span>
        </section>
      ) : null}

      {!admin ? (
        <section className="panel plans-panel" id="plans" aria-labelledby="plans-heading">
          <div className="panel-head">
            <div><h2 id="plans-heading">Available plans</h2><p>Monthly pricing in Philippine pesos. Paid plans activate after manual payment approval.</p></div>
            <span>PHP / month</span>
          </div>
          <div className="plans-grid">
            {plans.map((plan) => {
              const isCurrent = currentPlan === plan.key;
              const isRecommended = plan.key === "starter" && !isCurrent;
              return (
                <article className={`plan-option ${isCurrent ? "current" : ""} ${isRecommended ? "recommended" : ""}`} key={plan.key}>
                  {isCurrent ? <span className="plan-badge">Current</span> : isRecommended ? <span className="plan-badge">Popular</span> : null}
                  <h3>{plan.name}</h3>
                  <p>{plan.description}</p>
                  <div className="plan-price"><strong>{plan.price}</strong><span>/month</span></div>
                  <div className="plan-limit">{plan.limit.toLocaleString()} aliases included</div>
                  <ul className="plan-features">{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
                  {isCurrent ? (
                    <span className="plan-current">Your current plan</span>
                  ) : plan.key === "free" ? (
                    <span className="plan-current">Free tier</span>
                  ) : (
                    <Link className={`button ${plan.key === "starter" ? "button-primary" : "button-ghost"}`} href={`/checkout?plan=${plan.key}`}>Choose {plan.name}</Link>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

import { redirect } from "next/navigation";
import { GridIcon, MailIcon, ShieldIcon } from "@/components/icons";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Admin dashboard" };

type AdminStats = {
  total_aliases: number;
  total_customers: number;
  free: number;
  starter: number;
  pro: number;
  business: number;
};

const fallbackStats: AdminStats = {
  total_aliases: 0,
  total_customers: 0,
  free: 0,
  starter: 0,
  pro: 0,
  business: 0,
};

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: isAdmin } = await supabase.rpc("is_subscription_admin");
  if (!isAdmin) redirect("/dashboard");

  const { data } = await supabase.rpc("get_admin_dashboard_stats");
  const stats = (data || fallbackStats) as AdminStats;

  const plans = [
    { label: "Free", value: stats.free, note: "Customers on the free plan" },
    { label: "Starter", value: stats.starter, note: "Customers on Starter" },
    { label: "Pro", value: stats.pro, note: "Customers on Pro" },
    { label: "Business", value: stats.business, note: "Customers on Business" },
  ];

  return (
    <div className="dashboard">
      <div className="page-head">
        <div>
          <span className="page-kicker">Admin</span>
          <h1>BatMail admin dashboard</h1>
          <p>Monitor customers, aliases, and current subscription plan distribution.</p>
        </div>
        <span className="system-status"><i /> Admin only</span>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-top"><span>Total aliases</span><span className="stat-icon"><MailIcon /></span></div>
          <strong className="stat-value">{stats.total_aliases}</strong>
          <span className="stat-note">Aliases created across all customer accounts</span>
        </div>
        <div className="stat-card">
          <div className="stat-top"><span>Total customers</span><span className="stat-icon"><GridIcon /></span></div>
          <strong className="stat-value">{stats.total_customers}</strong>
          <span className="stat-note">Registered BatMail customer accounts</span>
        </div>
        <div className="stat-card">
          <div className="stat-top"><span>Paid customers</span><span className="stat-icon"><ShieldIcon /></span></div>
          <strong className="stat-value">{stats.starter + stats.pro + stats.business}</strong>
          <span className="stat-note">Starter, Pro, and Business combined</span>
        </div>
      </div>

      <section className="panel" aria-labelledby="plan-breakdown-heading">
        <div className="panel-head">
          <div>
            <h2 id="plan-breakdown-heading">Customers by plan</h2>
            <p>Current subscription distribution across all registered accounts.</p>
          </div>
          <span>{stats.total_customers} total</span>
        </div>

        <div className="stats-grid" style={{ padding: 20 }}>
          {plans.map((plan) => (
            <div className="stat-card" key={plan.label}>
              <div className="stat-top"><span>{plan.label}</span><span className="stat-icon"><GridIcon /></span></div>
              <strong className="stat-value">{plan.value}</strong>
              <span className="stat-note">{plan.note}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

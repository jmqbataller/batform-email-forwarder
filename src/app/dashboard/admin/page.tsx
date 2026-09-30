import { redirect } from "next/navigation";
import { GridIcon, MailIcon, ShieldIcon } from "@/components/icons";
import { createClient } from "@/lib/supabase/server";
import { manageCustomerSubscription } from "./actions";

export const metadata = { title: "Admin dashboard" };
export const dynamic = "force-dynamic";

type AdminStats = {
  total_aliases: number;
  total_customers: number;
  free: number;
  starter: number;
  pro: number;
  business: number;
};

type AdminCustomer = {
  user_id: string;
  name: string;
  email: string;
  plan: "free" | "starter" | "pro" | "business";
  status: string;
  current_period_end: string | null;
  created_at: string;
  alias_count: number;
};

const fallbackStats: AdminStats = {
  total_aliases: 0,
  total_customers: 0,
  free: 0,
  starter: 0,
  pro: 0,
  business: 0,
};

function planLabel(plan: string) {
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function formatDate(value: string | null) {
  if (!value) return "No expiry";
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: isAdmin } = await supabase.rpc("is_subscription_admin");
  if (!isAdmin) redirect("/dashboard");

  const [{ data: statsData }, { data: customerData, error: customerError }] = await Promise.all([
    supabase.rpc("get_admin_dashboard_stats"),
    supabase.rpc("get_admin_customers"),
  ]);

  const stats = (statsData || fallbackStats) as AdminStats;
  const customers = (customerData || []) as AdminCustomer[];

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
          <p>Monitor customers, aliases, subscriptions, and manually manage customer access.</p>
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

      <section className="panel" aria-labelledby="customer-management-heading">
        <div className="panel-head">
          <div>
            <h2 id="customer-management-heading">Customer management</h2>
            <p>View customer details and manually activate, renew, change, or revoke subscriptions.</p>
          </div>
          <span>{customers.length} accounts</span>
        </div>

        {customerError ? (
          <div className="empty-state"><div><h3>Unable to load customers</h3><p>{customerError.message}</p></div></div>
        ) : customers.length ? (
          <div style={{ overflowX: "auto", padding: "0 20px 20px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1080 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "14px 10px" }}>Customer</th>
                  <th style={{ padding: "14px 10px" }}>Plan</th>
                  <th style={{ padding: "14px 10px" }}>Status</th>
                  <th style={{ padding: "14px 10px" }}>Aliases</th>
                  <th style={{ padding: "14px 10px" }}>Expires</th>
                  <th style={{ padding: "14px 10px" }}>Subscription actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => {
                  const paid = customer.plan !== "free";
                  return (
                    <tr key={customer.user_id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "16px 10px", verticalAlign: "top" }}>
                        <div style={{ display: "grid", gap: 4 }}>
                          <strong>{customer.name}</strong>
                          <small>{customer.email}</small>
                          <small>Joined {formatDate(customer.created_at)}</small>
                        </div>
                      </td>
                      <td style={{ padding: "16px 10px", verticalAlign: "top" }}>
                        <strong>{planLabel(customer.plan)}</strong>
                      </td>
                      <td style={{ padding: "16px 10px", verticalAlign: "top" }}>
                        <span className={`alias-state ${customer.status === "active" || customer.status === "trialing" ? "enabled" : ""}`}>
                          <i /> {customer.status}
                        </span>
                      </td>
                      <td style={{ padding: "16px 10px", verticalAlign: "top" }}>{customer.alias_count}</td>
                      <td style={{ padding: "16px 10px", verticalAlign: "top" }}>{formatDate(customer.current_period_end)}</td>
                      <td style={{ padding: "16px 10px", verticalAlign: "top" }}>
                        <div style={{ display: "grid", gap: 10, minWidth: 360 }}>
                          <form action={manageCustomerSubscription} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                            <input type="hidden" name="user_id" value={customer.user_id} />
                            <input type="hidden" name="action" value="activate" />
                            <select name="plan" defaultValue={paid ? customer.plan : "starter"} aria-label={`Plan for ${customer.email}`}>
                              <option value="starter">Starter</option>
                              <option value="pro">Pro</option>
                              <option value="business">Business</option>
                            </select>
                            <input name="days" type="number" min="1" max="3650" defaultValue="30" aria-label="Subscription days" style={{ width: 82 }} />
                            <button className="button button-primary" type="submit">{paid ? "Change / Activate" : "Activate"}</button>
                          </form>

                          {paid ? (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              <form action={manageCustomerSubscription} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <input type="hidden" name="user_id" value={customer.user_id} />
                                <input type="hidden" name="action" value="renew" />
                                <input name="days" type="number" min="1" max="3650" defaultValue="30" aria-label="Renewal days" style={{ width: 82 }} />
                                <button className="button button-ghost" type="submit">Renew</button>
                              </form>

                              <form action={manageCustomerSubscription}>
                                <input type="hidden" name="user_id" value={customer.user_id} />
                                <input type="hidden" name="action" value="revoke" />
                                <input type="hidden" name="days" value="30" />
                                <button className="button button-ghost" type="submit" title="Immediately downgrade this customer to Free">Revoke</button>
                              </form>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state"><div><h3>No customers yet</h3><p>Registered BatMail users will appear here.</p></div></div>
        )}
      </section>
    </div>
  );
}
import { redirect } from "next/navigation";
import { GridIcon, MailIcon, ShieldIcon } from "@/components/icons";
import { createClient } from "@/lib/supabase/server";
import { manageCustomerSubscription } from "./actions";
import styles from "./admin.module.css";

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

function initials(name: string, email: string) {
  const source = name?.trim() || email.split("@")[0] || "U";
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
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
            <p>Manage plans without digging through raw subscription records.</p>
          </div>
          <span>{customers.length} accounts</span>
        </div>

        {customerError ? (
          <div className="empty-state"><div><h3>Unable to load customers</h3><p>{customerError.message}</p></div></div>
        ) : customers.length ? (
          <div className={styles.customerList}>
            {customers.map((customer) => {
              const paid = customer.plan !== "free";
              const active = customer.status === "active" || customer.status === "trialing";

              return (
                <article className={styles.customerCard} key={customer.user_id}>
                  <div className={styles.customerTop}>
                    <div className={styles.identity}>
                      <div className={styles.avatar} aria-hidden="true">{initials(customer.name, customer.email)}</div>
                      <div className={styles.identityText}>
                        <strong>{customer.name}</strong>
                        <span>{customer.email}</span>
                        <small>Joined {formatDate(customer.created_at)}</small>
                      </div>
                    </div>

                    <div className={styles.badges}>
                      <span className={styles.planBadge}>{planLabel(customer.plan)}</span>
                      <span className={`${styles.statusBadge} ${active ? styles.statusActive : ""}`}>{customer.status}</span>
                    </div>
                  </div>

                  <div className={styles.metaGrid}>
                    <div className={styles.metaItem}>
                      <span>Aliases</span>
                      <strong>{customer.alias_count}</strong>
                    </div>
                    <div className={styles.metaItem}>
                      <span>Expires</span>
                      <strong>{formatDate(customer.current_period_end)}</strong>
                    </div>
                    <div className={styles.metaItem}>
                      <span>Account ID</span>
                      <strong title={customer.user_id}>{customer.user_id.slice(0, 8)}…</strong>
                    </div>
                  </div>

                  <div className={styles.actionsArea}>
                    <form action={manageCustomerSubscription} className={styles.primaryAction}>
                      <input type="hidden" name="user_id" value={customer.user_id} />
                      <input type="hidden" name="action" value="activate" />

                      <div className={styles.control}>
                        <label htmlFor={`plan-${customer.user_id}`}>Plan</label>
                        <select id={`plan-${customer.user_id}`} name="plan" defaultValue={paid ? customer.plan : "starter"}>
                          <option value="starter">Starter</option>
                          <option value="pro">Pro</option>
                          <option value="business">Business</option>
                        </select>
                      </div>

                      <div className={styles.control}>
                        <label htmlFor={`days-${customer.user_id}`}>Days</label>
                        <input id={`days-${customer.user_id}`} name="days" type="number" min="1" max="3650" defaultValue="30" />
                      </div>

                      <button className={`button button-primary ${styles.actionButton}`} type="submit">
                        {paid ? "Update plan" : "Activate"}
                      </button>
                    </form>

                    {paid ? (
                      <div className={styles.secondaryActions}>
                        <form action={manageCustomerSubscription} className={styles.primaryAction}>
                          <input type="hidden" name="user_id" value={customer.user_id} />
                          <input type="hidden" name="action" value="renew" />
                          <div className={styles.control}>
                            <label htmlFor={`renew-${customer.user_id}`}>Renew</label>
                            <input id={`renew-${customer.user_id}`} name="days" type="number" min="1" max="3650" defaultValue="30" />
                          </div>
                          <button className={`button button-ghost ${styles.actionButton}`} type="submit">Add days</button>
                        </form>

                        <form action={manageCustomerSubscription}>
                          <input type="hidden" name="user_id" value={customer.user_id} />
                          <input type="hidden" name="action" value="revoke" />
                          <input type="hidden" name="days" value="30" />
                          <button className={`button ${styles.revokeButton}`} type="submit" title="Immediately downgrade this customer to Free">Revoke</button>
                        </form>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state"><div><h3>No customers yet</h3><p>Registered BatMail users will appear here.</p></div></div>
        )}
      </section>
    </div>
  );
}

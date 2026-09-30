import Link from "next/link";
import { AliasList } from "@/components/alias-list";
import { CreateAliasForm } from "@/components/create-alias-form";
import { EyeOffIcon, MailIcon, RefreshIcon } from "@/components/icons";
import { forwardingDomain } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import type { AliasRow } from "@/lib/types";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const [{ data: aliasesData }, { data: subscription }, { data: isAdmin }] = await Promise.all([
    supabase.from("aliases").select("*").order("created_at", { ascending: false }),
    supabase.from("user_subscriptions").select("plan,status").maybeSingle(),
    supabase.rpc("is_subscription_admin"),
  ]);

  const aliases = (aliasesData || []) as AliasRow[];
  const admin = Boolean(isAdmin);
  const currentPlan = subscription?.plan || "free";
  const planLabel = currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1);
  const paidAndActive = Boolean(
    subscription &&
    ["starter", "pro", "business"].includes(subscription.plan) &&
    ["active", "trialing"].includes(subscription.status),
  );
  const canEditAliases = admin || paidAndActive;
  const enabled = aliases.filter((alias) => alias.enabled).length;
  const forwarded = aliases.reduce((sum, alias) => sum + (alias.forwarded_count || 0), 0);

  return (
    <div className="dashboard">
      <div className="page-head">
        <div>
          <span className="page-kicker">Overview</span>
          <h1>Your privacy dashboard</h1>
          <p>Create and manage a separate private address for every website or account.</p>
        </div>
        <div style={{ display: "grid", gap: 10, justifyItems: "end" }}>
          <div className="nav-actions">
            <span className="system-status">
              <i />
              {admin ? "Admin · Unlimited" : `${planLabel} Plan`}
            </span>
            {!admin ? (
              <Link className={currentPlan === "free" ? "button button-primary" : "button button-ghost"} href="/dashboard/subscription">
                {currentPlan === "free" ? "Upgrade" : "Manage plan"}
              </Link>
            ) : null}
          </div>
          <CreateAliasForm />
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-top"><span>Total aliases</span><span className="stat-icon"><MailIcon /></span></div><strong className="stat-value">{aliases.length}</strong><span className="stat-note">Created for your account</span></div>
        <div className="stat-card"><div className="stat-top"><span>Active protection</span><span className="stat-icon"><EyeOffIcon /></span></div><strong className="stat-value">{enabled}</strong><span className="stat-note">Aliases accepting messages</span></div>
        <div className="stat-card"><div className="stat-top"><span>Forwarded</span><span className="stat-icon"><RefreshIcon /></span></div><strong className="stat-value">{forwarded}</strong><span className="stat-note">Messages delivered privately</span></div>
      </div>

      <section className="panel" aria-labelledby="aliases-heading">
        <div className="panel-head"><div><h2 id="aliases-heading">Recent aliases</h2><p>Your newest protected email identities</p></div><span>{forwardingDomain}</span></div>
        <AliasList aliases={aliases.slice(0, 10)} canEditAliases={canEditAliases} isAdmin={admin} />
      </section>
    </div>
  );
}

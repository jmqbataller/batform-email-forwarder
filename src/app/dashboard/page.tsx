import { AliasList } from "@/components/alias-list";
import { CreateAliasForm } from "@/components/create-alias-form";
import { EyeOffIcon, MailIcon, RefreshIcon } from "@/components/icons";
import { forwardingDomain } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import type { AliasRow } from "@/lib/types";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: aliasesData } = await supabase.from("aliases").select("*").order("created_at", { ascending: false });
  const aliases = (aliasesData || []) as AliasRow[];
  const enabled = aliases.filter((alias) => alias.enabled).length;
  const forwarded = aliases.reduce((sum, alias) => sum + (alias.forwarded_count || 0), 0);

  return (
    <div className="dashboard">
      <div className="page-head">
        <div><h1>Your aliases</h1><p>Create one private address for every website or account.</p></div>
        <CreateAliasForm />
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-top"><span>Total aliases</span><span className="stat-icon"><MailIcon /></span></div><strong className="stat-value">{aliases.length}</strong><span className="stat-note">Created for your account</span></div>
        <div className="stat-card"><div className="stat-top"><span>Active protection</span><span className="stat-icon"><EyeOffIcon /></span></div><strong className="stat-value">{enabled}</strong><span className="stat-note">Aliases accepting messages</span></div>
        <div className="stat-card"><div className="stat-top"><span>Forwarded</span><span className="stat-icon"><RefreshIcon /></span></div><strong className="stat-value">{forwarded}</strong><span className="stat-note">Messages delivered privately</span></div>
      </div>

      <section className="panel" aria-labelledby="aliases-heading">
        <div className="panel-head"><h2 id="aliases-heading">Recent aliases</h2><span>{forwardingDomain}</span></div>
        <AliasList aliases={aliases.slice(0, 10)} />
      </section>
    </div>
  );
}

import { CopyButton } from "@/components/copy-button";
import { EyeOffIcon, MailIcon, PlusIcon, RefreshIcon, TrashIcon } from "@/components/icons";
import { forwardingDomain } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import type { AliasRow } from "@/lib/types";
import { createAlias, deleteAlias, toggleAlias } from "./actions";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const [{ data: aliasesData }, { count: activityCount }] = await Promise.all([
    supabase.from("aliases").select("*").order("created_at", { ascending: false }),
    supabase.from("email_events").select("id", { count: "exact", head: true }).eq("status", "forwarded"),
  ]);
  const aliases = (aliasesData || []) as AliasRow[];
  const enabled = aliases.filter((alias) => alias.enabled).length;
  const forwarded = aliases.reduce((sum, alias) => sum + (alias.forwarded_count || 0), 0) || activityCount || 0;

  return (
    <div className="dashboard">
      <div className="page-head">
        <div><h1>Your aliases</h1><p>Create one private address for every website or account.</p></div>
        <form action={createAlias} className="create-form">
          <input name="label" maxLength={60} placeholder="Label (e.g. Shopping)" aria-label="Alias label" />
          <button className="button button-primary" type="submit"><PlusIcon /> New random alias</button>
        </form>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-top"><span>Total aliases</span><span className="stat-icon"><MailIcon /></span></div><strong className="stat-value">{aliases.length}</strong><span className="stat-note">Created for your account</span></div>
        <div className="stat-card"><div className="stat-top"><span>Active protection</span><span className="stat-icon"><EyeOffIcon /></span></div><strong className="stat-value">{enabled}</strong><span className="stat-note">Aliases accepting messages</span></div>
        <div className="stat-card"><div className="stat-top"><span>Forwarded</span><span className="stat-icon"><RefreshIcon /></span></div><strong className="stat-value">{forwarded}</strong><span className="stat-note">Messages delivered privately</span></div>
      </div>

      <section className="panel">
        <div className="panel-head"><h2>Email aliases</h2><span>{forwardingDomain}</span></div>
        {aliases.length ? (
          <div className="alias-list">
            {aliases.map((alias) => {
              const address = `${alias.local_part}@${forwardingDomain}`;
              return (
                <article className="alias-row" key={alias.id}>
                  <div className="alias-main"><span className="alias-glyph"><MailIcon /></span><div><strong className="alias-address">{address}</strong><span className="alias-label">{alias.label || "Random alias"}</span></div></div>
                  <div className="destination"><small>Forwards to</small><strong>{alias.destination}</strong></div>
                  <span className={`alias-state ${alias.enabled ? "enabled" : ""}`}><i /> {alias.enabled ? "Active" : "Paused"}</span>
                  <div className="row-actions">
                    <CopyButton value={address} />
                    <form action={toggleAlias}><input type="hidden" name="id" value={alias.id} /><input type="hidden" name="enabled" value={String(alias.enabled)} /><button className="icon-button" title={alias.enabled ? "Pause alias" : "Enable alias"} aria-label={alias.enabled ? "Pause alias" : "Enable alias"}><RefreshIcon /></button></form>
                    <form action={deleteAlias}><input type="hidden" name="id" value={alias.id} /><button className="icon-button danger" title="Delete alias" aria-label="Delete alias"><TrashIcon /></button></form>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state"><div><span className="empty-state-icon"><EyeOffIcon /></span><h3>No aliases yet</h3><p>Create your first random alias. Messages sent to it will arrive in your verified account inbox.</p></div></div>
        )}
      </section>
    </div>
  );
}

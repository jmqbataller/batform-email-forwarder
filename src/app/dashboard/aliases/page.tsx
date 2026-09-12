import { AliasList } from "@/components/alias-list";
import { CreateAliasForm } from "@/components/create-alias-form";
import { forwardingDomain } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import type { AliasRow } from "@/lib/types";

export const metadata = { title: "Email aliases" };

export default async function AliasesPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("aliases").select("*").order("created_at", { ascending: false });
  const aliases = (data || []) as AliasRow[];

  return (
    <div className="dashboard">
      <div className="page-head">
        <div><h1>Email aliases</h1><p>Manage, pause, copy, or remove every private address.</p></div>
        <CreateAliasForm />
      </div>
      <section className="panel" aria-labelledby="all-aliases-heading">
        <div className="panel-head"><h2 id="all-aliases-heading">All aliases</h2><span>{aliases.length} on {forwardingDomain}</span></div>
        <AliasList aliases={aliases} searchable />
      </section>
    </div>
  );
}

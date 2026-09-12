import { InboxList } from "@/components/inbox-list";
import { createClient } from "@/lib/supabase/server";
import type { InboxMessageRow } from "@/lib/types";

export const metadata = { title: "Inbox" };

export default async function InboxPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_events")
    .select("id,original_from,subject,status,created_at,aliases!inner(local_part,label)")
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const messages = (data || []) as unknown as InboxMessageRow[];

  return (
    <div className="dashboard">
      <div className="page-head">
        <div><h1>Inbox</h1><p>Read emails inside BatMail and identify each one instantly by its alias label.</p></div>
      </div>
      <section className="panel" aria-labelledby="inbox-heading">
        <div className="panel-head"><h2 id="inbox-heading">Incoming messages</h2><span>Latest 100</span></div>
        <InboxList messages={messages} />
      </section>
    </div>
  );
}

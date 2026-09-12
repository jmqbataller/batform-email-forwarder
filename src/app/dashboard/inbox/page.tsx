import { ClockIcon } from "@/components/icons";
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
        <div><span className="page-kicker">Messages</span><h1>Inbox</h1><p>Read incoming mail and identify every message instantly by its alias label.</p></div>
        <div className="retention-notice"><ClockIcon /><span><strong>30-day retention</strong>Email messages are deleted automatically.</span></div>
      </div>
      <section className="panel" aria-labelledby="inbox-heading">
        <div className="panel-head"><div><h2 id="inbox-heading">Incoming messages</h2><p>Search by label, sender, subject, or alias</p></div><span>Latest 100</span></div>
        <InboxList messages={messages} />
      </section>
    </div>
  );
}

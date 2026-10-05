import { ClockIcon } from "@/components/icons";
import { InboxAutoRefresh } from "@/components/inbox-auto-refresh";
import { InboxList } from "@/components/inbox-list";
import { createClient } from "@/lib/supabase/server";
import type { InboxMessageRow } from "@/lib/types";

export const metadata = { title: "Inbox" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 150;

export default async function InboxPage() {
  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("email_events")
    .select("id,original_from,subject,status,created_at,aliases!inner(local_part,domain,label)", { count: "exact" })
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(0, PAGE_SIZE - 1);

  if (error) throw error;

  const messages = (data || []) as unknown as InboxMessageRow[];
  const totalMessages = count || 0;

  return (
    <div className="dashboard">
      <div className="page-head">
        <div><span className="page-kicker">Messages</span><h1>Inbox</h1><p>Read incoming mail and identify every message instantly by its alias label.</p></div>
        <div className="retention-notice"><ClockIcon /><span><strong>30-day retention</strong>Email messages are deleted automatically.</span></div>
      </div>
      <section className="panel" aria-labelledby="inbox-heading">
        <div className="panel-head">
          <div>
            <h2 id="inbox-heading">Incoming messages</h2>
            <p>Newest messages first · Auto-load 150 at a time · Auto-refresh every 5 seconds</p>
          </div>
          <div className="panel-head-meta">
            <InboxAutoRefresh intervalMs={5000} />
            <span>{totalMessages} total</span>
          </div>
        </div>
        <InboxList messages={messages} totalMessages={totalMessages} pageSize={PAGE_SIZE} />
      </section>
    </div>
  );
}

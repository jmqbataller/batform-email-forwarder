import { MailIcon } from "@/components/icons";
import { createClient } from "@/lib/supabase/server";
import type { EmailEventRow } from "@/lib/types";

export const metadata = { title: "Activity" };

const activityDateFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
});

export default async function ActivityPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("email_events").select("id,direction,masked_sender,subject,status,created_at").order("created_at", { ascending: false }).limit(100);
  const events = (data || []) as EmailEventRow[];

  return (
    <div className="dashboard">
      <div className="page-head"><div><h1>Activity</h1><p>See the latest messages processed by your private aliases.</p></div></div>
      <section className="panel" aria-labelledby="activity-heading">
        <div className="panel-head"><h2 id="activity-heading">Recent email activity</h2><span>Latest 100 events</span></div>
        {events.length ? (
          <div className="activity-list">
            {events.map((event) => (
              <article className="activity-row" key={event.id}>
                <span className="alias-glyph"><MailIcon /></span>
                <div className="activity-copy"><strong>{event.subject || "No subject"}</strong><span>{event.masked_sender || "Private sender"}</span></div>
                <span className={`event-status ${event.status}`}>{event.status}</span>
                <time dateTime={event.created_at}>{activityDateFormatter.format(new Date(event.created_at))} PHT</time>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state"><div><span className="empty-state-icon"><MailIcon /></span><h3>No email activity yet</h3><p>When a message reaches one of your aliases, its delivery status will appear here.</p></div></div>
        )}
      </section>
    </div>
  );
}

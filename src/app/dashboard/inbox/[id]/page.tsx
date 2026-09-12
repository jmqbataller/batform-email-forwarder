import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, InboxIcon } from "@/components/icons";
import { forwardingDomain } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import type { InboxMessageDetail } from "@/lib/types";

export const metadata = { title: "Inbox message" };

const messageDateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "UTC",
});

export default async function InboxMessagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_events")
    .select("id,direction,original_from,original_to,masked_sender,subject,text_body,status,created_at,aliases!inner(local_part,label)")
    .eq("id", id)
    .eq("direction", "inbound")
    .maybeSingle();
  if (error || !data) notFound();
  const message = data as unknown as InboxMessageDetail;
  const label = message.aliases.label || "Unlabeled";
  const aliasAddress = `${message.aliases.local_part}@${forwardingDomain}`;

  return (
    <div className="dashboard message-dashboard">
      <Link className="back-link" href="/dashboard/inbox"><ArrowLeftIcon /> Back to inbox</Link>
      <article className="message-card">
        <header className="message-head">
          <span className="alias-glyph"><InboxIcon /></span>
          <div><span className="message-label">{label}</span><h1>{message.subject || "No subject"}</h1></div>
        </header>
        <dl className="message-meta">
          <div><dt>From</dt><dd>{message.original_from || "Unknown sender"}</dd></div>
          <div><dt>Alias</dt><dd>{aliasAddress}</dd></div>
          <div><dt>Received</dt><dd>{messageDateFormatter.format(new Date(message.created_at))} UTC</dd></div>
          <div><dt>Forwarding</dt><dd><span className={`event-status ${message.status}`}>{message.status}</span></dd></div>
        </dl>
        <section className="message-content" aria-labelledby="message-content-heading">
          <h2 id="message-content-heading">Message</h2>
          {message.text_body ? <pre>{message.text_body}</pre> : <p>This earlier email was processed before in-app message storage was enabled. New incoming emails will show their full text here.</p>}
        </section>
      </article>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { ClockIcon } from "@/components/icons";
import { InboxAutoRefresh } from "@/components/inbox-auto-refresh";
import { InboxList } from "@/components/inbox-list";
import { createClient } from "@/lib/supabase/server";
import type { InboxMessageRow } from "@/lib/types";

export const metadata = { title: "Inbox" };

const PAGE_SIZE = 500;

type InboxPageProps = {
  searchParams: Promise<{ page?: string | string[] }>;
};

function pageNumberFrom(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw || "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function InboxPage({ searchParams }: InboxPageProps) {
  const requestedPage = pageNumberFrom((await searchParams).page);
  const from = (requestedPage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("email_events")
    .select("id,original_from,subject,status,created_at,aliases!inner(local_part,label)", { count: "exact" })
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);

  if (error) throw error;

  const totalMessages = count || 0;
  const totalPages = Math.max(1, Math.ceil(totalMessages / PAGE_SIZE));
  if (totalMessages > 0 && requestedPage > totalPages) {
    redirect(`/dashboard/inbox?page=${totalPages}`);
  }

  const messages = (data || []) as unknown as InboxMessageRow[];
  const pageStart = totalMessages === 0 ? 0 : from + 1;
  const pageEnd = Math.min(from + messages.length, totalMessages);
  const hasPrevious = requestedPage > 1;
  const hasNext = requestedPage < totalPages;

  return (
    <div className="dashboard">
      <InboxAutoRefresh intervalMs={5000} />
      <div className="page-head">
        <div><span className="page-kicker">Messages</span><h1>Inbox</h1><p>Read incoming mail and identify every message instantly by its alias label.</p></div>
        <div className="retention-notice"><ClockIcon /><span><strong>30-day retention</strong>Email messages are deleted automatically.</span></div>
      </div>
      <section className="panel" aria-labelledby="inbox-heading">
        <div className="panel-head">
          <div>
            <h2 id="inbox-heading">Incoming messages</h2>
            <p>Newest messages first · 500 messages per page · Auto-refresh every 5 seconds</p>
          </div>
          <span>{pageStart}-{pageEnd} of {totalMessages}</span>
        </div>
        <InboxList messages={messages} />
        <nav className="inbox-pagination" aria-label="Inbox pagination">
          {hasPrevious ? (
            <Link className="button button-ghost" href={requestedPage === 2 ? "/dashboard/inbox" : `/dashboard/inbox?page=${requestedPage - 1}`}>
              Previous
            </Link>
          ) : (
            <span className="button button-ghost pagination-disabled" aria-disabled="true">Previous</span>
          )}
          <span className="pagination-status">Page {requestedPage} of {totalPages}</span>
          {hasNext ? (
            <Link className="button button-ghost" href={`/dashboard/inbox?page=${requestedPage + 1}`}>
              Next
            </Link>
          ) : (
            <span className="button button-ghost pagination-disabled" aria-disabled="true">Next</span>
          )}
        </nav>
      </section>
    </div>
  );
}

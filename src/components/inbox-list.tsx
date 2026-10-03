"use client";

import Link from "next/link";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowRightIcon, InboxIcon, SearchIcon } from "@/components/icons";
import { forwardingDomain } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";
import type { InboxMessageRow } from "@/lib/types";

const inboxDateFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
});

type InboxListProps = {
  messages: InboxMessageRow[];
  totalMessages: number;
  pageSize: number;
};

function mergeUnique(current: InboxMessageRow[], incoming: InboxMessageRow[]) {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);

  return Array.from(byId.values()).sort((a, b) => {
    const timeDifference = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (timeDifference !== 0) return timeDifference;
    return b.id.localeCompare(a.id);
  });
}

export function InboxList({ messages, totalMessages, pageSize }: InboxListProps) {
  const [query, setQuery] = useState("");
  const [loadedMessages, setLoadedMessages] = useState(messages);
  const [knownTotal, setKnownTotal] = useState(totalMessages);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    setLoadedMessages((current) => mergeUnique(current, messages));
    setKnownTotal(totalMessages);
  }, [messages, totalMessages]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || loadedMessages.length >= knownTotal) return;

    setIsLoadingMore(true);
    try {
      const supabase = createClient();
      const from = loadedMessages.length;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from("email_events")
        .select("id,original_from,subject,status,created_at,aliases!inner(local_part,label)", { count: "exact" })
        .eq("direction", "inbound")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to);

      if (error) throw error;

      setLoadedMessages((current) =>
        mergeUnique(current, (data || []) as unknown as InboxMessageRow[]),
      );
      if (typeof count === "number") setKnownTotal(count);
    } catch (error) {
      console.error("Unable to auto-load more inbox messages", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, knownTotal, loadedMessages.length, pageSize]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || loadedMessages.length >= knownTotal) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "500px 0px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [loadMore, loadedMessages.length, knownTotal]);

  const filteredMessages = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    if (!normalizedQuery) return loadedMessages;

    return loadedMessages.filter((message) => {
      const aliasAddress = `${message.aliases.local_part}@${forwardingDomain}`;
      return [message.aliases.label, aliasAddress, message.subject, message.original_from]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedQuery));
    });
  }, [deferredQuery, loadedMessages]);

  const isUpdating = query !== deferredQuery;
  const hasMore = loadedMessages.length < knownTotal;

  if (!loadedMessages.length) {
    return (
      <div className="empty-state">
        <div><span className="empty-state-icon"><InboxIcon /></span><h3>Your inbox is ready</h3><p>New emails sent to an active alias will appear here and will still forward to your verified email.</p></div>
      </div>
    );
  }

  return (
    <>
      <div className="list-toolbar">
        <label className="search-field" htmlFor="inbox-label-search">
          <SearchIcon />
          <span className="sr-only">Search inbox by alias label</span>
          <input
            id="inbox-label-search"
            type="search"
            placeholder="Search loaded messages"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
          />
        </label>
        <span aria-live="polite">
          {query
            ? `${filteredMessages.length} matching loaded messages`
            : `${loadedMessages.length} of ${knownTotal} messages`}
        </span>
      </div>

      {filteredMessages.length ? (
        <>
          <div className="list-columns inbox-columns" aria-hidden="true">
            <span>Message</span><span>Alias label</span><span>Received</span><span />
          </div>
          <div className="inbox-list" style={{ opacity: isUpdating ? 0.65 : 1 }}>
            {filteredMessages.map((message) => {
              const label = message.aliases.label || "Unlabeled";
              const aliasAddress = `${message.aliases.local_part}@${forwardingDomain}`;

              return (
                <Link
                  className="inbox-row"
                  href={`/dashboard/inbox/${message.id}`}
                  key={message.id}
                  aria-label={`Open ${message.subject || "message without a subject"}, label ${label}`}
                >
                  <span className="alias-glyph"><InboxIcon /></span>
                  <span className="inbox-copy">
                    <strong>{message.subject || "No subject"}</strong>
                    <small>{message.original_from || "Unknown sender"}</small>
                  </span>
                  <span className="inbox-alias">
                    <strong>{label}</strong>
                    <small title={aliasAddress}>{aliasAddress}</small>
                  </span>
                  <time dateTime={message.created_at}>{inboxDateFormatter.format(new Date(message.created_at))} PHT</time>
                  <ArrowRightIcon />
                </Link>
              );
            })}
          </div>
        </>
      ) : (
        <div className="empty-state filtered-empty">
          <div><span className="empty-state-icon"><SearchIcon /></span><h3>No matching messages</h3><p>Try a different label, sender, alias address, or subject.</p></div>
        </div>
      )}

      {!query && (
        <div ref={loadMoreRef} className="inbox-auto-load" aria-live="polite">
          {isLoadingMore
            ? "Loading more messages…"
            : hasMore
              ? "Scroll to load more"
              : `All ${knownTotal} messages loaded`}
        </div>
      )}
    </>
  );
}

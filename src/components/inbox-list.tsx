"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { ArrowRightIcon, InboxIcon, SearchIcon } from "@/components/icons";
import { forwardingDomain } from "@/lib/config";
import type { InboxMessageRow } from "@/lib/types";

const inboxDateFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
});

export function InboxList({ messages }: { messages: InboxMessageRow[] }) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const filteredMessages = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    if (!normalizedQuery) return messages;

    return messages.filter((message) => {
      const aliasAddress = `${message.aliases.local_part}@${forwardingDomain}`;
      return [message.aliases.label, aliasAddress, message.subject, message.original_from]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedQuery));
    });
  }, [deferredQuery, messages]);
  const isUpdating = query !== deferredQuery;

  if (!messages.length) {
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
            placeholder="Search label, sender, or subject"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
          />
        </label>
        <span aria-live="polite">{filteredMessages.length} {filteredMessages.length === 1 ? "message" : "messages"}</span>
      </div>
      {filteredMessages.length ? (
        <><div className="list-columns inbox-columns" aria-hidden="true"><span>Message</span><span>Alias label</span><span>Received</span><span /></div><div className="inbox-list" style={{ opacity: isUpdating ? 0.65 : 1 }}>
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
        </div></>
      ) : (
        <div className="empty-state filtered-empty"><div><span className="empty-state-icon"><SearchIcon /></span><h3>No matching messages</h3><p>Try a different label, sender, alias address, or subject.</p></div></div>
      )}
    </>
  );
}

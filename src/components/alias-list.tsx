"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { AliasActionButton } from "@/components/alias-action-button";
import { AliasLabelEditor } from "@/components/alias-label-editor";
import { CopyButton } from "@/components/copy-button";
import { EyeOffIcon, MailIcon, SearchIcon } from "@/components/icons";
import { forwardingDomain } from "@/lib/config";
import type { AliasRow } from "@/lib/types";
import { deleteAlias, toggleAlias } from "@/app/dashboard/actions";

export function AliasList({ aliases, searchable = false }: { aliases: AliasRow[]; searchable?: boolean }) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const filteredAliases = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    if (!normalizedQuery) return aliases;

    return aliases.filter((alias) => {
      const address = `${alias.local_part}@${forwardingDomain}`;
      return [alias.label, address, alias.destination]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedQuery));
    });
  }, [aliases, deferredQuery]);
  const isUpdating = query !== deferredQuery;

  if (!aliases.length) {
    return (
      <div className="empty-state">
        <div><span className="empty-state-icon"><EyeOffIcon /></span><h3>No aliases yet</h3><p>Create your first random alias. Messages sent to it will arrive in your verified account inbox.</p></div>
      </div>
    );
  }

  return (
    <>
      {searchable ? (
        <div className="list-toolbar">
          <label className="search-field" htmlFor="alias-label-search">
            <SearchIcon />
            <span className="sr-only">Search aliases by label</span>
            <input
              id="alias-label-search"
              type="search"
              placeholder="Search by label"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoComplete="off"
            />
          </label>
          <span aria-live="polite">{filteredAliases.length} {filteredAliases.length === 1 ? "match" : "matches"}</span>
        </div>
      ) : null}
      {filteredAliases.length ? (
        <div className="alias-list" style={{ opacity: isUpdating ? 0.65 : 1 }}>
          {filteredAliases.map((alias) => {
            const address = `${alias.local_part}@${forwardingDomain}`;

            return (
              <article className="alias-row" key={alias.id}>
                <div className="alias-main"><span className="alias-glyph"><MailIcon /></span><div><strong className="alias-address" title={address}>{address}</strong><AliasLabelEditor aliasId={alias.id} label={alias.label} /></div></div>
                <div className="destination"><small>Forwards to</small><strong title={alias.destination}>{alias.destination}</strong></div>
                <div className="alias-controls">
                  <span className={`alias-state ${alias.enabled ? "enabled" : ""}`}><i /> {alias.enabled ? "Active" : "Paused"}</span>
                  <div className="row-actions">
                    <CopyButton value={address} />
                    <form action={toggleAlias}><input type="hidden" name="id" value={alias.id} /><input type="hidden" name="enabled" value={String(alias.enabled)} /><AliasActionButton kind="toggle" label={alias.enabled ? "Pause alias" : "Enable alias"} /></form>
                    <form action={deleteAlias}><input type="hidden" name="id" value={alias.id} /><AliasActionButton kind="delete" label="Delete alias" confirmMessage={`Delete ${address}? This cannot be undone.`} /></form>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state filtered-empty"><div><span className="empty-state-icon"><SearchIcon /></span><h3>No matching label</h3><p>Try another label or search using the alias address.</p></div></div>
      )}
    </>
  );
}

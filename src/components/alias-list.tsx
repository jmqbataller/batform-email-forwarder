"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { AliasActionButton } from "@/components/alias-action-button";
import { AliasAddressEditor } from "@/components/alias-address-editor";
import { AliasLabelEditor } from "@/components/alias-label-editor";
import { CopyButton } from "@/components/copy-button";
import { EyeOffIcon, MailIcon, SearchIcon } from "@/components/icons";
import { forwardingDomain } from "@/lib/config";
import { aliasActivation } from "@/lib/alias-activation";
import { useClock } from "@/lib/use-clock";
import type { AliasRow } from "@/lib/types";
import { deleteAlias, toggleAlias } from "@/app/dashboard/actions";
import styles from "./alias-list.module.css";

const EDIT_WINDOW_MS = 3 * 60 * 1000;

export function AliasList({ aliases, searchable = false, canEditAliases = false, isAdmin = false }: { aliases: AliasRow[]; searchable?: boolean; canEditAliases?: boolean; isAdmin?: boolean }) {
  const [query, setQuery] = useState("");
  const now = useClock();
  const deferredQuery = useDeferredValue(query);
  const filteredAliases = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    if (!normalizedQuery) return aliases;
    return aliases.filter((alias) => {
      const address = `${alias.local_part}@${forwardingDomain}`;
      return [alias.label, address, alias.destination].filter(Boolean).some((value) => value!.toLowerCase().includes(normalizedQuery));
    });
  }, [aliases, deferredQuery]);

  if (!aliases.length) {
    return <div className={styles.empty}><EyeOffIcon /><h3>No aliases yet</h3><p>Create your first private alias to get started.</p></div>;
  }

  return (
    <div className={styles.wrap}>
      {searchable ? (
        <div className={styles.toolbar}>
          <label className={styles.search} htmlFor="alias-search">
            <SearchIcon />
            <input id="alias-search" type="search" placeholder="Search aliases" value={query} onChange={(event) => setQuery(event.target.value)} autoComplete="off" />
          </label>
          <span className={styles.count}>{filteredAliases.length} {filteredAliases.length === 1 ? "alias" : "aliases"}</span>
        </div>
      ) : null}

      <div className={styles.list}>
        {filteredAliases.map((alias) => {
          const address = `${alias.local_part}@${forwardingDomain}`;
          const withinEditWindow = now > 0 && now < new Date(alias.created_at).getTime() + EDIT_WINDOW_MS;
          const canModify = isAdmin || (canEditAliases && withinEditWindow);
          const activation = aliasActivation(alias.enabled, alias.routing_ready_at);

          return (
            <article className={styles.card} key={alias.id}>
              <div className={styles.identity}>
                <span className={styles.icon}><MailIcon /></span>
                <div className={styles.details}>
                  <div className={styles.addressWrap}><AliasAddressEditor aliasId={alias.id} localPart={alias.local_part} canEdit={canModify} /></div>
                  <AliasLabelEditor aliasId={alias.id} label={alias.label} canEdit={canModify} />
                  <div className={styles.metaRow}>
                    {isAdmin ? <><span className={styles.badge}>Admin</span><span className={`${styles.badge} ${styles.mutedBadge}`}>Unlimited</span></> : null}
                    {!isAdmin && canEditAliases && !withinEditWindow ? <span className={styles.lockNote}>Editing window expired</span> : null}
                    {!isAdmin && !canEditAliases ? <span className={styles.lockNote}>Upgrade to edit or delete</span> : null}
                  </div>
                </div>
              </div>

              <div className={styles.destination}>
                <small>Forwards to</small>
                <strong title={alias.destination}>{alias.destination}</strong>
              </div>

              <div className={styles.controls}>
                <span className={`${styles.status} ${activation.ready ? styles.statusOn : activation.pending ? styles.statusPending : ""}`} title={activation.pending ? "Email routing setup must finish before using this address." : undefined}><i className={styles.dot} />{activation.label}</span>
                <div className={styles.actions}>
                  <CopyButton value={address} disabled={!activation.ready} title={activation.ready ? "Copy alias" : alias.enabled ? "Email routing setup is not complete" : "Enable this alias before copying"} />
                  <form action={toggleAlias}><input type="hidden" name="id" value={alias.id} /><input type="hidden" name="enabled" value={String(alias.enabled)} /><AliasActionButton kind="toggle" label={alias.enabled ? "Pause alias" : "Enable alias"} /></form>
                  {canModify ? <form action={deleteAlias}><input type="hidden" name="id" value={alias.id} /><AliasActionButton kind="delete" label="Delete alias" confirmMessage={`Delete ${address}? This cannot be undone.`} /></form> : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {!filteredAliases.length ? <div className={styles.empty}><SearchIcon /><h3>No matching aliases</h3><p>Try another label, address, or destination.</p></div> : null}
    </div>
  );
}

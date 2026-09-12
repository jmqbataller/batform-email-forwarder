import { AliasActionButton } from "@/components/alias-action-button";
import { CopyButton } from "@/components/copy-button";
import { EyeOffIcon, MailIcon } from "@/components/icons";
import { forwardingDomain } from "@/lib/config";
import type { AliasRow } from "@/lib/types";
import { deleteAlias, toggleAlias } from "@/app/dashboard/actions";

export function AliasList({ aliases }: { aliases: AliasRow[] }) {
  if (!aliases.length) {
    return (
      <div className="empty-state">
        <div><span className="empty-state-icon"><EyeOffIcon /></span><h3>No aliases yet</h3><p>Create your first random alias. Messages sent to it will arrive in your verified account inbox.</p></div>
      </div>
    );
  }

  return (
    <div className="alias-list">
      {aliases.map((alias) => {
        const address = `${alias.local_part}@${forwardingDomain}`;

        return (
          <article className="alias-row" key={alias.id}>
            <div className="alias-main"><span className="alias-glyph"><MailIcon /></span><div><strong className="alias-address" title={address}>{address}</strong><span className="alias-label">{alias.label || "Random alias"}</span></div></div>
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
  );
}

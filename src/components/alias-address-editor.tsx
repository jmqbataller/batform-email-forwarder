"use client";

import { useState, useTransition } from "react";
import { renameAliasAddress } from "@/app/dashboard/actions";
import { CheckIcon, PencilIcon, XIcon } from "@/components/icons";

export function AliasAddressEditor({ aliasId, localPart, domain, canEdit }: { aliasId: string; localPart: string; domain: string; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await renameAliasAddress(formData);
      if (result.status === "success") setEditing(false);
      else setError(result.message);
    });
  }

  if (!canEdit) {
    return <strong className="alias-address" title={`${localPart}@${domain}`}>{localPart}@{domain}</strong>;
  }

  if (!editing) {
    return (
      <button className="alias-address alias-address-edit" type="button" onClick={() => setEditing(true)} title="Edit alias address">
        <span>{localPart}@{domain}</span><PencilIcon />
      </button>
    );
  }

  return (
    <div className="alias-label-editor alias-address-editor">
      <form action={handleSubmit}>
        <input type="hidden" name="id" value={aliasId} />
        <input name="local_part" defaultValue={localPart} minLength={6} maxLength={48} pattern="[a-z0-9][a-z0-9._-]{5,47}" autoFocus aria-label="Alias address name" disabled={pending} />
        <span className="alias-domain">@{domain}</span>
        <button type="submit" aria-label="Save alias address" title="Save alias address" disabled={pending}><CheckIcon /></button>
        <button type="button" aria-label="Cancel editing alias address" title="Cancel" onClick={() => { setError(""); setEditing(false); }} disabled={pending}><XIcon /></button>
      </form>
      {error ? <small role="alert">{error}</small> : null}
    </div>
  );
}

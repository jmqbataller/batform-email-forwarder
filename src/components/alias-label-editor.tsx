"use client";

import { useState, useTransition } from "react";
import { renameAlias } from "@/app/dashboard/actions";
import { CheckIcon, PencilIcon, XIcon } from "@/components/icons";

export function AliasLabelEditor({ aliasId, label }: { aliasId: string; label: string | null }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await renameAlias(formData);
      if (result.status === "success") setEditing(false);
      else setError(result.message);
    });
  }

  if (!editing) {
    return (
      <button className={`alias-label-button ${label ? "" : "empty"}`} type="button" onClick={() => setEditing(true)} title={label ? "Edit label" : "Add label"}>
        <span>{label || "Add label"}</span><PencilIcon />
      </button>
    );
  }

  return (
    <div className="alias-label-editor">
      <form action={handleSubmit}>
        <input type="hidden" name="id" value={aliasId} />
        <input name="label" defaultValue={label || ""} maxLength={60} placeholder="e.g. Canva" autoFocus aria-label="Alias label" disabled={pending} />
        <button type="submit" aria-label="Save label" title="Save label" disabled={pending}><CheckIcon /></button>
        <button type="button" aria-label="Cancel editing label" title="Cancel" onClick={() => { setError(""); setEditing(false); }} disabled={pending}><XIcon /></button>
      </form>
      {error ? <small role="alert">{error}</small> : null}
    </div>
  );
}

"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { PlusIcon } from "@/components/icons";
import { createAlias } from "@/app/dashboard/actions";
import { aliasDomains, forwardingDomain } from "@/lib/config";

const initialAliasActionState = { status: "idle" as const, message: "" };

export function CreateAliasForm() {
  const [state, formAction, pending] = useActionState(createAlias, initialAliasActionState);
  const [domain, setDomain] = useState<string>(forwardingDomain);
  const labelRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.status === "success" && labelRef.current) labelRef.current.value = "";
  }, [state]);

  return (
    <div className="create-form-wrap">
      {/* Keep the chosen domain when React resets an action form; clear only the successful label. */}
      <form action={formAction} className="create-form" onReset={(event) => event.preventDefault()}>
        <input ref={labelRef} name="label" maxLength={60} placeholder="Label (e.g. Shopping)" aria-label="Alias label" disabled={pending} />
        <select name="domain" aria-label="Alias domain" value={domain} onChange={(event) => setDomain(event.target.value)} disabled={pending}>
          {aliasDomains.map((option) => <option key={option} value={option}>@{option}</option>)}
        </select>
        <button className="button button-primary" type="submit" disabled={pending} aria-busy={pending}>
          <PlusIcon /> {pending ? "Creating…" : "New random alias"}
        </button>
      </form>
      <span className={`action-feedback ${state.status}`} aria-live="polite">
        {pending ? "Setting up your private address and email routing…" : state.message}
      </span>
    </div>
  );
}

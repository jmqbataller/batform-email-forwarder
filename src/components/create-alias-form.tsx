"use client";

import { useActionState, useEffect, useRef } from "react";
import { PlusIcon } from "@/components/icons";
import { createAlias } from "@/app/dashboard/actions";

const initialAliasActionState = { status: "idle" as const, message: "" };

export function CreateAliasForm() {
  const [state, formAction, pending] = useActionState(createAlias, initialAliasActionState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <div className="create-form-wrap">
      <form ref={formRef} action={formAction} className="create-form">
        <input name="label" maxLength={60} placeholder="Label (e.g. Shopping)" aria-label="Alias label" disabled={pending} />
        <button className="button button-primary" type="submit" disabled={pending} aria-busy={pending}>
          <PlusIcon /> {pending ? "Creating…" : "New random alias"}
        </button>
      </form>
      <span className={`action-feedback ${state.status}`} aria-live="polite">
        {pending ? "Creating your private address…" : state.message}
      </span>
    </div>
  );
}

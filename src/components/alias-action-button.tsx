"use client";

import { useFormStatus } from "react-dom";
import { RefreshIcon, TrashIcon } from "@/components/icons";

type AliasActionButtonProps = {
  kind: "toggle" | "delete";
  label: string;
  confirmMessage?: string;
};

export function AliasActionButton({ kind, label, confirmMessage }: AliasActionButtonProps) {
  const { pending } = useFormStatus();
  const Icon = kind === "delete" ? TrashIcon : RefreshIcon;

  return (
    <button
      className={`icon-button ${kind === "delete" ? "danger" : ""}`}
      type="submit"
      title={pending ? "Saving…" : label}
      aria-label={pending ? "Saving change" : label}
      aria-busy={pending}
      disabled={pending}
      onClick={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault();
      }}
    >
      <Icon />
    </button>
  );
}

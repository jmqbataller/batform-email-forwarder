"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "@/components/icons";

export function CopyButton({ value, disabled = false, title }: { value: string; disabled?: boolean; title?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (disabled) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  return (
    <button className="icon-button" type="button" onClick={copy} aria-label="Copy alias" disabled={disabled} title={title}>
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

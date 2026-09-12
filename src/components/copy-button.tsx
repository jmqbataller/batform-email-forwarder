"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "@/components/icons";

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  return (
    <button className="icon-button" type="button" onClick={copy} aria-label="Copy alias">
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

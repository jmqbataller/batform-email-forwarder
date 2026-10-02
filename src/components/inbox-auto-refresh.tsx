"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const DEFAULT_INTERVAL_MS = 5_000;

export function InboxAutoRefresh({ intervalMs = DEFAULT_INTERVAL_MS }: { intervalMs?: number }) {
  const router = useRouter();
  const refreshingRef = useRef(false);

  useEffect(() => {
    const refresh = () => {
      if (document.hidden || !navigator.onLine || refreshingRef.current) return;

      refreshingRef.current = true;
      router.refresh();

      window.setTimeout(() => {
        refreshingRef.current = false;
      }, 1_000);
    };

    const timer = window.setInterval(refresh, intervalMs);

    const handleVisibility = () => {
      if (!document.hidden) refresh();
    };

    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [intervalMs, router]);

  return null;
}

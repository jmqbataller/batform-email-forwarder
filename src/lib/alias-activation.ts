export const ALIAS_ACTIVATION_MS = 2 * 60 * 1000;

export function aliasActivation(enabled: boolean, readyAt: string | null, now: number) {
  if (!enabled) return { ready: false, label: "Paused", pending: false };
  const deadline = readyAt ? Date.parse(readyAt) : NaN;
  if (!Number.isFinite(deadline)) return { ready: false, label: "Setting up", pending: true };
  if (!now) return { ready: false, label: "Checking activation…", pending: true };
  const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));
  if (!remaining) return { ready: true, label: "Active", pending: false };
  return { ready: false, label: `Activating ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`, pending: true };
}

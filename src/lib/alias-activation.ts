export function aliasActivation(enabled: boolean, readyAt: string | null) {
  if (!enabled) return { ready: false, label: "Paused", pending: false };
  if (!readyAt || !Number.isFinite(Date.parse(readyAt))) return { ready: false, label: "Setting up", pending: true };
  // A saved timestamp confirms successful routing setup. Legacy future deadlines
  // also represent provisioned routes; the fixed activation wait no longer applies.
  return { ready: true, label: "Active", pending: false };
}

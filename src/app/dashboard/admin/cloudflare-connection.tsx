"use client";

import { useRef, useState, useTransition } from "react";
import { connectCloudflare, syncCloudflare } from "./cloudflare-actions";

export function CloudflareConnection({ initiallyConnected }: { initiallyConnected: boolean }) {
  const [connected, setConnected] = useState(initiallyConnected);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const form = useRef<HTMLFormElement>(null);

  async function syncAll() {
    let offset: number | null = 0;
    let synced = 0;
    const failures: string[] = [];
    while (offset !== null) {
      const result = await syncCloudflare(offset);
      if (result.error) { setMessage(result.error); setErrors(failures); return; }
      synced += result.synced || 0;
      failures.push(...(result.errors || []));
      setMessage(`Checked ${synced} aliases. Syncing existing addresses…`);
      offset = result.next_offset ?? null;
    }
    setErrors(failures);
    setMessage(failures.length
      ? `${synced} aliases ready; ${failures.length} need attention. Fix the issue below and sync again.`
      : `${synced} aliases ready to receive mail. New aliases will be connected automatically.`);
  }

  function connect(formData: FormData) {
    startTransition(async () => {
      setErrors([]);
      setMessage("Checking Cloudflare connection…");
      try {
        const result = await connectCloudflare(formData);
        form.current?.reset();
        if (result.error) { setMessage(result.error); return; }
        setConnected(true);
        await syncAll();
      } catch { setMessage("Connection interrupted. Retry the connection or sync."); }
    });
  }

  return (
    <section className="panel" aria-labelledby="cloudflare-heading">
      <div className="panel-head"><div><h2 id="cloudflare-heading">Email routing</h2><p>Choose cspro.space, dnd.cspro.space, canvasphere.cyou, or beng.canvasphere.cyou when creating an alias.</p></div><span>{connected ? "Connected" : "Setup required"}</span></div>
      <div style={{ padding: 20 }}>
        <p>Create a custom token with Zone → Zone → Read and Zone → Email Routing Rules → Edit, scoped to both cspro.space and canvasphere.cyou.</p>
        <p>For canvasphere.cyou, enable the root-domain catch-all with the batform-email-forwarder Worker. For beng.canvasphere.cyou, enable Email Routing for the beng subdomain. The system checks routing before creating an address.</p>
        <p><a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noopener noreferrer">Create Cloudflare token</a>. The token is stored encrypted and is never displayed after saving.</p>
        <form ref={form} action={connect} className="create-form">
          <input name="token" type="password" placeholder="Cloudflare API token" aria-label="Cloudflare API token" autoComplete="off" required minLength={20} maxLength={500} disabled={pending} />
          <button className="button button-primary" type="submit" disabled={pending}>{pending ? "Working…" : connected ? "Replace token and sync" : "Connect Cloudflare"}</button>
        </form>
        {connected ? <button className="button button-ghost" type="button" disabled={pending} style={{ marginTop: 12 }} onClick={() => startTransition(async () => { setErrors([]); try { await syncAll(); } catch { setMessage("Sync interrupted. Please retry."); } })}>Sync existing aliases</button> : null}
        <p role="status" aria-live="polite">{message}</p>
        {errors.length ? <details><summary>Aliases that need attention ({errors.length})</summary><ul>{errors.map((error, index) => <li key={index}>{error}</li>)}</ul></details> : null}
      </div>
    </section>
  );
}

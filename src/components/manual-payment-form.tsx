"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const PLAN_PRICES = {
  starter: 149,
  pro: 349,
  business: 749,
} as const;

type PaidPlan = keyof typeof PLAN_PRICES;

type Props = {
  userId: string;
  pendingPlan?: string | null;
  pendingStatus?: string | null;
};

export function ManualPaymentForm({ userId, pendingPlan, pendingStatus }: Props) {
  const router = useRouter();
  const [plan, setPlan] = useState<PaidPlan>((pendingPlan as PaidPlan) || "starter");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [qrSrc, setQrSrc] = useState("");
  const supabase = createClient();

  useEffect(() => {
    fetch("/gcash-payment.jpg")
      .then((response) => response.text())
      .then((value) => setQrSrc(value.trim()))
      .catch(() => setQrSrc(""));
  }, []);

  const amount = PLAN_PRICES[plan];
  const hasPending = pendingStatus === "pending";

  async function submitPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || busy || hasPending) return;

    if (file.size > 5 * 1024 * 1024) {
      setMessage("Receipt must be 5 MB or smaller.");
      return;
    }

    const allowed = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) {
      setMessage("Upload a PNG, JPG, WEBP, or PDF receipt.");
      return;
    }

    setBusy(true);
    setMessage("");

    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const receiptPath = `${userId}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("payment-receipts")
      .upload(receiptPath, file, { upsert: false, contentType: file.type });

    if (uploadError) {
      setBusy(false);
      setMessage(`Could not upload receipt: ${uploadError.message}`);
      return;
    }

    const { error: insertError } = await supabase.from("payment_submissions").insert({
      user_id: userId,
      requested_plan: plan,
      amount_php: amount,
      receipt_path: receiptPath,
    });

    if (insertError) {
      await supabase.storage.from("payment-receipts").remove([receiptPath]);
      setBusy(false);
      setMessage(`Could not submit payment: ${insertError.message}`);
      return;
    }

    setBusy(false);
    setFile(null);
    setMessage("Payment receipt submitted. Your request is now waiting for approval.");
    router.refresh();
  }

  return (
    <section className="panel" aria-labelledby="manual-payment-heading">
      <div className="panel-head">
        <div>
          <h2 id="manual-payment-heading">Pay with GCash</h2>
          <p>Temporary manual payment flow. Your paid plan activates only after admin approval.</p>
        </div>
        {hasPending ? <span>Pending approval</span> : null}
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-top"><span>1. Choose a plan</span></div>
          <label>
            <span className="stat-note">Subscription plan</span>
            <select value={plan} onChange={(event) => setPlan(event.target.value as PaidPlan)} disabled={hasPending || busy}>
              <option value="starter">Starter — ₱149 / month</option>
              <option value="pro">Pro — ₱349 / month</option>
              <option value="business">Business — ₱749 / month</option>
            </select>
          </label>
          <strong className="stat-value">₱{amount}</strong>
          <span className="stat-note">Pay the exact amount shown above.</span>
        </div>

        <div className="stat-card">
          <div className="stat-top"><span>2. Scan and pay</span></div>
          {qrSrc ? <img src={qrSrc} alt="GCash QR payment code" style={{ width: "100%", maxWidth: 280, margin: "0 auto", display: "block", borderRadius: 16 }} /> : <p>Loading payment QR…</p>}
          <span className="stat-note">GCash / InstaPay QR. Transfer fees may apply depending on your bank or wallet.</span>
        </div>

        <div className="stat-card">
          <div className="stat-top"><span>3. Upload receipt</span></div>
          <form onSubmit={submitPayment}>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              disabled={hasPending || busy}
              required
            />
            <button className="button button-primary" type="submit" disabled={!file || hasPending || busy} style={{ marginTop: 12 }}>
              {busy ? "Submitting…" : hasPending ? "Waiting for approval" : `Submit ₱${amount} payment`}
            </button>
          </form>
          {message ? <p className="stat-note" role="status">{message}</p> : null}
          {hasPending ? <p className="stat-note">You already have a payment waiting for review. Your current plan stays unchanged until approval.</p> : null}
        </div>
      </div>
    </section>
  );
}

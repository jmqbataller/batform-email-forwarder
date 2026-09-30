"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./checkout.module.css";

const PLAN_DATA = {
  starter: { name: "Starter", price: 149, aliases: 20, features: ["20 private aliases", "Edit/delete within 3 minutes", "Private forwarding", "Activity inbox"] },
  pro: { name: "Pro", price: 349, aliases: 100, features: ["100 private aliases", "Everything in Starter", "Higher usage capacity", "Built for heavy personal use"] },
  business: { name: "Business", price: 749, aliases: 1000, features: ["1,000 private aliases", "Everything in Pro", "Business-scale capacity", "Ready for team workflows"] },
} as const;

type PaidPlan = keyof typeof PLAN_DATA;

export function CheckoutForm({ userId, initialPlan, pendingPlan, pendingStatus }: { userId: string; initialPlan: PaidPlan; pendingPlan?: string | null; pendingStatus?: string | null }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const supabase = createClient();
  const plan = PLAN_DATA[initialPlan];
  const hasPending = pendingStatus === "pending";

  async function submitPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || busy || hasPending) return;
    setMessage("");
    setError("");

    if (file.size > 5 * 1024 * 1024) {
      setError("Receipt must be 5 MB or smaller.");
      return;
    }
    const allowed = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) {
      setError("Upload a PNG, JPG, WEBP, or PDF receipt.");
      return;
    }

    setBusy(true);
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const receiptPath = `${userId}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage.from("payment-receipts").upload(receiptPath, file, { upsert: false, contentType: file.type });
    if (uploadError) {
      setBusy(false);
      setError(`Could not upload receipt: ${uploadError.message}`);
      return;
    }

    const { error: insertError } = await supabase.from("payment_submissions").insert({ user_id: userId, requested_plan: initialPlan, amount_php: plan.price, receipt_path: receiptPath });
    if (insertError) {
      await supabase.storage.from("payment-receipts").remove([receiptPath]);
      setBusy(false);
      setError(`Could not submit payment: ${insertError.message}`);
      return;
    }

    setBusy(false);
    setFile(null);
    setMessage("Receipt submitted successfully. Your subscription is now pending admin approval.");
    router.refresh();
  }

  return (
    <div className={styles.grid}>
      <section className={`${styles.card} ${styles.payment}`}>
        <div className={styles.sectionTitle}>
          <div><h2>Complete your payment</h2><p>Pay through GCash, then upload your receipt. Your plan stays unchanged until approval.</p></div>
          <span className={styles.planPill}>Manual approval</span>
        </div>

        {hasPending ? <div className={styles.pending}>You already have a {pendingPlan ? `${pendingPlan} ` : ""}payment request waiting for approval. You cannot submit another one yet.</div> : null}

        <div className={styles.step}>
          <span className={styles.stepNo}>1</span>
          <div className={styles.stepBody}><h3>Scan the GCash QR</h3><p>Pay the exact amount shown in your order summary.</p><div className={styles.qrWrap}><img src="/gcash-payment.jpg" alt="GCash QR payment code" /></div></div>
        </div>

        <div className={styles.step}>
          <span className={styles.stepNo}>2</span>
          <div className={styles.stepBody}>
            <h3>Upload your payment receipt</h3><p>Accepted: JPG, PNG, WEBP, or PDF up to 5 MB.</p>
            <form className={styles.upload} onSubmit={submitPayment}>
              <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} disabled={hasPending || busy} required />
              <button className={`button button-primary button-large ${styles.submit}`} type="submit" disabled={!file || hasPending || busy}>{busy ? "Submitting…" : hasPending ? "Waiting for approval" : `Submit ₱${plan.price} payment`}</button>
            </form>
            {message ? <div className={styles.success}>{message}</div> : null}
            {error ? <div className={styles.error}>{error}</div> : null}
            <p className={styles.note}>Activation is manual. Your paid features begin only after your receipt is approved.</p>
          </div>
        </div>
      </section>

      <aside className={`${styles.card} ${styles.summary}`}>
        <span className={styles.planPill}>Selected plan</span>
        <div className={styles.price}>₱{plan.price}</div>
        <div className={styles.per}>{plan.name} · per month</div>
        <ul className={styles.features}>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
        <div className={styles.change}>
          {(Object.keys(PLAN_DATA) as PaidPlan[]).map((key) => <Link key={key} href={`/checkout?plan=${key}`} className={key === initialPlan ? styles.activePlan : undefined}>{PLAN_DATA[key].name}</Link>)}
        </div>
      </aside>
    </div>
  );
}

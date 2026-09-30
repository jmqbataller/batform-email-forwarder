import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { reviewPayment } from "./actions";

export const metadata = { title: "Payment approvals" };

export default async function PaymentApprovalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: isAdmin } = await supabase.rpc("is_subscription_admin");
  if (!isAdmin) redirect("/dashboard");

  const { data: payments } = await supabase
    .from("payment_submissions")
    .select("id,user_id,requested_plan,amount_php,receipt_path,status,submitted_at,reviewed_at,admin_note")
    .order("submitted_at", { ascending: false });

  const rows = await Promise.all((payments || []).map(async (payment) => {
    const { data } = await supabase.storage.from("payment-receipts").createSignedUrl(payment.receipt_path, 60 * 30);
    return { ...payment, receiptUrl: data?.signedUrl || null };
  }));

  return (
    <div className="dashboard">
      <div className="page-head">
        <div>
          <span className="page-kicker">Admin</span>
          <h1>Payment approvals</h1>
          <p>Review uploaded GCash receipts before activating paid subscriptions.</p>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div><h2>Manual subscription requests</h2><p>Approval activates the selected plan for 30 days.</p></div>
          <span>{rows.filter((row) => row.status === "pending").length} pending</span>
        </div>

        <div className="alias-list">
          {rows.length ? rows.map((payment) => (
            <article className="alias-row" key={payment.id}>
              <div className="alias-main">
                <div>
                  <strong>{payment.requested_plan.charAt(0).toUpperCase() + payment.requested_plan.slice(1)} · ₱{payment.amount_php}</strong>
                  <small>User: {payment.user_id}</small>
                  <small>Submitted: {new Date(payment.submitted_at).toLocaleString("en-PH")}</small>
                  {payment.admin_note ? <small>Note: {payment.admin_note}</small> : null}
                </div>
              </div>

              <div className="destination">
                <small>Receipt</small>
                {payment.receiptUrl ? <a className="button button-ghost" href={payment.receiptUrl} target="_blank" rel="noreferrer">Open receipt</a> : <span>Unavailable</span>}
              </div>

              <div className="alias-controls">
                <span className={`alias-state ${payment.status === "approved" ? "enabled" : ""}`}><i /> {payment.status}</span>
                {payment.status === "pending" ? (
                  <form action={reviewPayment} style={{ display: "grid", gap: 8 }}>
                    <input type="hidden" name="id" value={payment.id} />
                    <input name="note" maxLength={500} placeholder="Optional admin note" />
                    <div className="row-actions">
                      <button className="button button-primary" type="submit" name="status" value="approved">Approve</button>
                      <button className="button button-ghost" type="submit" name="status" value="rejected">Reject</button>
                    </div>
                  </form>
                ) : null}
              </div>
            </article>
          )) : <div className="empty-state"><div><h3>No payment submissions yet</h3><p>New receipt uploads will appear here.</p></div></div>}
        </div>
      </section>
    </div>
  );
}

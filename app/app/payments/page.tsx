"use client";

import { useState } from "react";
import { Clock3, IndianRupee, Phone, WalletCards } from "lucide-react";
import { dayTime, inr, istToday, overdueDays, shortDate, useBeat, type Shop } from "@/components/data";
import { Empty, Field, Loading, Modal, PageHead, Pill } from "@/components/ui";

export default function Payments() {
  const { data, act, notify } = useBeat();
  const [paying, setPaying] = useState<{ shop: Shop; amount: string; method: string; note: string } | null>(null);
  const [busy, setBusy] = useState("");

  if (!data) return <Loading />;
  const today = istToday();
  const owing = data.shops.filter((s) => s.credit_due > 0).sort((a, b) => b.credit_due - a.credit_due);
  const openPromises = data.promises.filter((p) => p.status === "open");
  const missed = openPromises.filter((p) => p.promise_date < today);
  const pending = data.callbacks.filter((c) => c.status === "pending");

  async function record(e: React.FormEvent) {
    e.preventDefault();
    if (!paying) return;
    setBusy("pay");
    const out = await act<{ remaining: number }>("/api/payments", "POST", { shop_id: paying.shop.id, amount: paying.amount, method: paying.method, note: paying.note });
    setBusy("");
    if (out) {
      notify(`${inr(Number(paying.amount.replace(/\D/g, "")))} received from ${paying.shop.name}. ${out.remaining ? `${inr(out.remaining)} still due.` : "Balance cleared."}`);
      setPaying(null);
    }
  }

  async function callNow(id: number, name: string) {
    setBusy(`cb-${id}`);
    const out = await act(`/api/callbacks/${id}`, "POST");
    setBusy("");
    if (out) notify(`Calling ${name}…`);
  }

  return (
    <>
      <PageHead title="Payments" sub="Who owes you, what they promised on calls, and who asked to be called back." />

      <section className="stats-grid">
        <div className="stat-card"><div className="stat-icon orange"><IndianRupee /></div><div className="stat-copy"><span>Outstanding credit</span><strong>{inr(data.stats.outstanding)}</strong><small>{owing.length} shops owe money</small></div></div>
        <div className="stat-card"><div className="stat-icon teal"><WalletCards /></div><div className="stat-copy"><span>Collected today</span><strong>{inr(data.stats.collected)}</strong><small>recorded here</small></div></div>
        <div className="stat-card"><div className="stat-icon violet"><Clock3 /></div><div className="stat-copy"><span>Open promises</span><strong>{inr(openPromises.reduce((t, p) => t + p.amount, 0))}</strong><small>{openPromises.length} promises</small></div></div>
        <div className="stat-card"><div className="stat-icon blue"><Phone /></div><div className="stat-copy"><span>Missed promises</span><strong>{missed.length}</strong><small>{missed.length ? "follow up today" : "none, nice"}</small></div></div>
      </section>

      <section className="lower-grid">
        <div className="panel">
          <div className="panel-header"><div><h2>Who owes you</h2><p>Beat asks these shops for a payment date on its next call once they are 7+ days overdue.</p></div></div>
          {owing.length === 0 ? <p className="panel-empty">Nobody owes you anything right now.</p> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>SHOP</th><th>DUE</th><th>OVERDUE</th><th>PROMISE</th><th /></tr></thead>
                <tbody>
                  {owing.map((s) => {
                    const days = overdueDays(s.credit_due_since) ?? 0;
                    return (
                      <tr key={s.id}>
                        <td><b>{s.name}</b><span>{s.area}</span></td>
                        <td className="due"><b>{inr(s.credit_due)}</b></td>
                        <td><b className={days >= 30 ? "danger-text" : ""}>{days} days</b></td>
                        <td>{s.promise_amount && s.promise_date ? <><b>{inr(s.promise_amount)}</b><span>{s.promise_date < today ? "missed " : "on "}{shortDate(s.promise_date)}</span></> : <span>None</span>}</td>
                        <td><button className="button secondary small" onClick={() => setPaying({ shop: s, amount: String(s.promise_amount ?? s.credit_due), method: "cash", note: "" })}>Record payment</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="side-stack">
          <div className="panel">
            <div className="panel-header"><div><h2>Payment promises</h2><p>Logged by Beat on calls</p></div></div>
            {data.promises.length === 0 && <p className="panel-empty">No promises yet.</p>}
            {data.promises.slice(0, 12).map((p) => {
              const isMissed = p.status === "open" && p.promise_date < today;
              return (
                <div className="promise-item" key={p.id}>
                  <div className={`promise-icon ${isMissed ? "missed" : "money"}`}>₹</div>
                  <div><b>{p.shop_name}</b><span>{inr(p.amount)} on {shortDate(p.promise_date)}</span></div>
                  {p.status === "kept" ? <Pill kind="live">Kept</Pill> : isMissed ? <Pill kind="danger">Missed</Pill> : <Pill kind="ringing">Open</Pill>}
                </div>
              );
            })}
          </div>

          <div className="panel">
            <div className="panel-header"><div><h2>Callbacks</h2><p>Beat rings them back at the time they asked</p></div></div>
            {data.callbacks.length === 0 && <p className="panel-empty">No callbacks booked.</p>}
            {pending.map((b) => (
              <div className="promise-item" key={b.id}>
                <div className="promise-icon callback"><Clock3 /></div>
                <div><b>{b.shop_name}</b><span>{b.callback_at ? dayTime(b.callback_at) : b.note ?? "No time given"}</span></div>
                <div className="row-actions">
                  <button className="call-button" disabled={!data.can_call || busy === `cb-${b.id}`} onClick={() => callNow(b.id, b.shop_name)}><Phone /> Now</button>
                  <button className="text-button" onClick={() => act(`/api/callbacks/${b.id}`, "PATCH", { status: "done" })}>Done</button>
                </div>
              </div>
            ))}
            {data.callbacks.filter((c) => c.status !== "pending").slice(0, 5).map((b) => (
              <div className="promise-item faded" key={b.id}>
                <div className="promise-icon callback"><Clock3 /></div>
                <div><b>{b.shop_name}</b><span>{b.callback_at ? dayTime(b.callback_at) : b.note}</span></div>
                <Pill kind="muted">{b.status === "dialled" ? "Called back" : b.status}</Pill>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="section-heading spaced"><div><h2>Payment history</h2><p>Money you recorded as received</p></div></div>
      {data.payments.length === 0 ? (
        <Empty icon={<WalletCards />} title="No payments recorded yet"><p>Use Record payment when a shop pays you. Their balance drops and any matching promise is marked kept.</p></Empty>
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table>
              <thead><tr><th>WHEN</th><th>SHOP</th><th>AMOUNT</th><th>METHOD</th><th>NOTE</th></tr></thead>
              <tbody>
                {data.payments.map((y) => (
                  <tr key={y.id}><td>{dayTime(y.received_at)}</td><td><b>{y.shop_name}</b></td><td><b>{inr(y.amount)}</b></td><td>{y.method.toUpperCase()}</td><td><span>{y.note ?? "—"}</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {paying && (
        <Modal title={`Payment from ${paying.shop.name}`} onClose={() => setPaying(null)}>
          <form className="form-grid" onSubmit={record}>
            <p className="span muted">They owe {inr(paying.shop.credit_due)}.</p>
            <Field label="Amount received (₹)"><input required inputMode="numeric" value={paying.amount} onChange={(e) => setPaying({ ...paying, amount: e.target.value })} /></Field>
            <Field label="Paid by">
              <select value={paying.method} onChange={(e) => setPaying({ ...paying, method: e.target.value })}>
                <option value="cash">Cash</option><option value="upi">UPI</option><option value="cheque">Cheque</option>
              </select>
            </Field>
            <Field label="Note" span><input value={paying.note} onChange={(e) => setPaying({ ...paying, note: e.target.value })} placeholder="UPI ref, collected by…" /></Field>
            <div className="modal-actions span">
              <button type="button" className="button secondary" onClick={() => setPaying(null)}>Cancel</button>
              <button className="button primary" disabled={busy === "pay"}>{busy === "pay" ? "Saving…" : "Record payment"}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

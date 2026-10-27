"use client";

import { useEffect, useRef } from "react";
import { Leaf, X } from "lucide-react";
import { clock, inr, LIVE, type Order } from "./data";

export function Pill({ kind, children, pulse }: { kind: string; children: React.ReactNode; pulse?: boolean }) {
  return <span className={`status-pill status-${kind}`}>{pulse && <span className="pulse" />}{children}</span>;
}

/** What happened on a call, as a pill. */
export function CallState({ status, outcome, total }: { status: string | null; outcome: string | null; total?: number | null }) {
  if (!status) return <Pill kind="muted">Not called</Pill>;
  if (LIVE.has(status) && !outcome) return status === "in-progress" || status === "in_progress"
    ? <Pill kind="live" pulse>On the call</Pill>
    : <Pill kind="ringing" pulse>Ringing</Pill>;
  if (outcome === "ordered") return <Pill kind="ordered">Ordered{total ? ` ${inr(total)}` : ""}</Pill>;
  if (outcome === "promised") return <Pill kind="payment">Promised payment</Pill>;
  if (outcome === "callback") return <Pill kind="ringing">Call back later</Pill>;
  if (LIVE.has(status)) return <Pill kind="live" pulse>On the call</Pill>;
  if (status === "completed") return <Pill kind="muted">No order</Pill>;
  return <Pill kind="muted">{status.replace(/[-_]/g, " ")}</Pill>;
}

const ORDER_PILL: Record<string, [string, string]> = {
  new: ["ringing", "New"],
  packed: ["ordered", "Packed"],
  dispatched: ["payment", "Out for delivery"],
  delivered: ["live", "Delivered"],
  cancelled: ["muted", "Cancelled"],
};
export function OrderState({ status }: { status: string }) {
  const [kind, label] = ORDER_PILL[status] ?? ["muted", status];
  return <Pill kind={kind}>{label}</Pill>;
}

export function OrderSlip({ order, fresh, delivery, children }: { order: Order; fresh?: boolean; delivery: string; children?: React.ReactNode }) {
  return (
    <article className={`order-slip ${order.status === "new" ? "" : "lime"} ${fresh ? "printing" : ""}`}>
      <div className="slip-top">
        <div>
          <span className="slip-live"><span /> {order.status === "new" ? "NEW ORDER" : `B-${1000 + order.id}`}</span>
          <h3>{order.shop_name}</h3>
          <p>{order.area ? `${order.area} · ` : ""}{clock(order.created_at)}{order.source === "salesman" ? " · by salesman" : ""}</p>
        </div>
        <OrderState status={order.status} />
      </div>
      <div className="receipt-line" />
      <div className="receipt-header"><span>QTY</span><span>ITEM</span><span>AMOUNT</span></div>
      {order.lines.map((l) => (
        <div className="receipt-item" key={l.code}>
          <b>{l.qty}</b>
          <span>{l.name}<small>{l.pack} @ {inr(l.price)}{l.off > 0 ? ` − ${inr(l.off)} scheme` : ""}</small></span>
          <strong>{inr(l.total)}</strong>
        </div>
      ))}
      {order.discount > 0 && <div className="scheme-tag"><Leaf /> Scheme savings <b>{inr(order.discount)}</b></div>}
      <div className="receipt-total"><span>TOTAL</span><strong>{inr(order.total)}</strong></div>
      <div className="delivery-note">
        <span className="truck-dot" />
        {order.status === "delivered"
          ? <>Delivered{order.paid_by ? <b> · {order.paid_by === "credit" ? "on credit" : "cash collected"}</b> : null}</>
          : order.status === "cancelled" ? "Cancelled" : <b>{delivery}</b>}
      </div>
      {children && <div className="slip-actions">{children}</div>}
      <div className="slip-tail" />
    </article>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("input, select, textarea")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Close" onClick={onClose}><X /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, hint, children, span }: { label: string; hint?: string; children: React.ReactNode; span?: boolean }) {
  return (
    <label className={`field ${span ? "span" : ""}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function Empty({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <b>{title}</b>
      {children}
    </div>
  );
}

export function PageHead({ eyebrow, title, sub, children, live }: { eyebrow?: string; title: string; sub: string; children?: React.ReactNode; live?: boolean }) {
  return (
    <section className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow"><span className="eyebrow-dot" /> {eyebrow}</div>}
        <h1>{title}{live && <span className="live-badge"><span /> LIVE</span>}</h1>
        <p>{sub}</p>
      </div>
      {children && <div className="heading-actions">{children}</div>}
    </section>
  );
}

export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="tabs" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? "active" : ""} onClick={() => onChange(o.value)}>
          {o.label}{o.count !== undefined && <span>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Loading() {
  return <div className="loading"><div className="mini-wave"><span /><span /><span /><span /><span /><span /><span /></div>Loading your beat…</div>;
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Line = { code: string; name: string; pack: string; qty: number; price: number; off: number; total: number };
type Shop = {
  id: number; name: string; owner_name: string; phone: string | null; area: string; language: string;
  credit_due: number; credit_due_since: string | null; is_demo_caller: boolean; dialable: boolean;
  last_total: number | null; last_order_at: string | null; last_source: string | null;
  call_status: string | null; call_outcome: string | null; call_at: string | null;
  promise_amount: number | null; promise_date: string | null;
};
type Order = { id: number; shop_name: string; area: string; is_demo_caller: boolean; phone: string | null; lines: Line[]; discount: number; total: number; created_at: string };
type Call = {
  execution_id: string; shop_name: string | null; phone: string | null; is_demo_caller: boolean | null; direction: string | null;
  status: string; outcome: string | null; started_at: string; duration_sec: number | null; transcript: string | null; recording_url: string | null;
};
type Promise_ = { id: number; shop_name: string; phone: string | null; is_demo_caller: boolean; amount: number; promise_date: string; created_at: string };
type Callback = { id: number; shop_name: string; callback_at: string | null; note: string | null };
type Data = {
  distributor: string; can_call: boolean; pin_required: boolean;
  stats: { orders: number; booked: number; promised: number; calls: number };
  shops: Shop[]; orders: Order[]; calls: Call[]; promises: Promise_[]; callbacks: Callback[];
};

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const LANG: Record<string, string> = { kn: "Kannada", hi: "Hindi", en: "English" };
const LIVE = new Set(["queued", "scheduled", "initiated", "ringing", "in-progress", "in_progress"]);

function ago(iso: string | null) {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 50) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  const d = Math.round(s / 86400);
  return d === 1 ? "yesterday" : `${d} days ago`;
}
const shortDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00+05:30` : iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const tail = (phone: string | null) => (phone ? `••${phone.slice(-4)}` : "");
const shopLabel = (name: string | null, demo: boolean | null, phone: string | null) =>
  demo ? `${name} (demo caller ${tail(phone)})` : name ?? "Unknown number";

function readPin() { try { return localStorage.getItem("beat-pin") ?? ""; } catch { return ""; } }
function savePin(p: string) { try { localStorage.setItem("beat-pin", p); } catch { /* storage blocked: ask again next time */ } }

export default function Dashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const seen = useRef<Set<number> | null>(null);
  const [fresh, setFresh] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      if (!res.ok) throw new Error(`Dashboard data failed to load (${res.status}). Check DATABASE_URL.`);
      const d: Data = await res.json();
      // Only orders that arrive while the page is open get the print animation.
      if (seen.current) {
        const added = d.orders.filter((o) => !seen.current!.has(o.id)).map((o) => o.id);
        if (added.length) setFresh(new Set(added));
      }
      seen.current = new Set(d.orders.map((o) => o.id));
      setData(d);
      setLoadError("");
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [load]);

  async function admin(path: string, init: RequestInit) {
    let pin = readPin();
    if (data?.pin_required && !pin) {
      pin = window.prompt("Dashboard PIN") ?? "";
      if (!pin) return null;
    }
    const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", "x-beat-pin": pin } });
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) { savePin(""); setNotice({ text: body.error ?? "Wrong PIN.", error: true }); return null; }
    if (pin) savePin(pin);
    if (!res.ok) { setNotice({ text: body.error ?? `Request failed (${res.status}).`, error: true }); return null; }
    return body;
  }

  async function startBeat(shopIds?: number[]) {
    setBusy(shopIds ? `call-${shopIds[0]}` : "beat");
    const body = await admin("/api/beat", { method: "POST", body: JSON.stringify({ shop_ids: shopIds }) });
    setBusy("");
    if (!body) return;
    const r = body.results as { shop: string; ok: boolean; reason?: string }[];
    const placed = r.filter((x) => x.ok).map((x) => x.shop);
    const skipped = r.filter((x) => !x.ok);
    setNotice({
      text: [
        placed.length ? `Calling ${placed.join(", ")}.` : "No calls placed.",
        ...skipped.map((x) => `${x.shop}: ${x.reason}.`),
      ].join(" "),
      error: !placed.length,
    });
    load();
  }

  async function savePhone(id: number, phone: string) {
    const body = await admin(`/api/shops/${id}`, { method: "PATCH", body: JSON.stringify({ phone }) });
    if (body) { setNotice({ text: `${body.shop.name} will be called on ${body.shop.phone}.` }); load(); }
  }

  async function reset() {
    if (!window.confirm("Clear today's calls and orders and go back to the starting demo data?")) return;
    setBusy("reset");
    const body = await admin("/api/demo/reset", { method: "POST" });
    setBusy("");
    if (body) { seen.current = null; setNotice({ text: "Demo data reset." }); load(); }
  }

  if (!data) {
    return <main className="top"><p>{loadError || "Loading today's beat…"}</p></main>;
  }

  const s = data.stats;
  const dialable = data.shops.filter((x) => !x.is_demo_caller && x.dialable).length;

  return (
    <main>
      <header className="top">
        <div>
          <div className="brand">
            <h1 className="wordmark">Beat<span>.</span></h1>
            <span className="who">{data.distributor}, Bengaluru</span>
          </div>
          <p className="summary">
            {s.calls === 0
              ? "No calls yet today. Start the beat, or ring the agent's number and play the shopkeeper."
              : <>Today: <b>{s.orders} {s.orders === 1 ? "order" : "orders"}</b> worth <b>{inr(s.booked)}</b> from <b>{s.calls} {s.calls === 1 ? "call" : "calls"}</b>, and <b>{inr(s.promised)}</b> of overdue credit promised.</>}
          </p>
        </div>
        <div className="actions">
          <button className="btn" onClick={reset} disabled={busy === "reset"}>Reset demo</button>
          <button
            className="btn primary"
            onClick={() => startBeat()}
            disabled={busy === "beat" || !data.can_call || dialable === 0}
            title={!data.can_call ? "Add your Bolna API key and agent IDs to place calls" : dialable === 0 ? "Add a real phone number to at least one shop" : ""}
          >
            {busy === "beat" ? "Starting…" : `Start beat (${dialable} ${dialable === 1 ? "shop" : "shops"})`}
          </button>
        </div>
      </header>

      {loadError && <div className="notice error">{loadError} Showing the last data loaded.</div>}
      {notice && <div className={`notice${notice.error ? " error" : ""}`} role="status">{notice.text}</div>}

      <div className="grid">
        <aside className="roll" aria-label="Orders booked on calls">
          <h2>Orders from calls</h2>
          <p className="sub">Each slip prints the moment the agent books it.</p>
          <div className="slot" aria-hidden="true" />
          <div className="slips">
            {data.orders.length === 0 && (
              <div className="empty-roll">Waiting for the first order. It prints here while the call is still going.</div>
            )}
            {data.orders.map((o) => (
              <article key={o.id} className={`slip${fresh.has(o.id) ? " fresh" : ""}`}>
                <header>
                  <div>
                    <div className="shopname">{o.shop_name}</div>
                    <div className="meta">{o.is_demo_caller ? `Demo caller ${tail(o.phone)}` : o.area}</div>
                  </div>
                  <div className="meta">B-{1000 + o.id}<br />{ago(o.created_at)}</div>
                </header>
                <hr />
                <table>
                  <tbody>
                    {o.lines.map((l) => (
                      <tr key={l.code}>
                        <td className="q">{l.qty}</td>
                        <td>{l.name}<div className="meta">{l.pack} @ {inr(l.price)}</div>{l.off > 0 && <div className="scheme">Scheme: {inr(l.off)} off each</div>}</td>
                        <td className="r">{inr(l.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <hr />
                {o.discount > 0 && <div className="meta">Scheme savings {inr(o.discount)}</div>}
                <div className="total"><span>Total</span><span>{inr(o.total)}</span></div>
                <div className="meta">Deliver tomorrow before 11 AM</div>
              </article>
            ))}
          </div>
        </aside>

        <div>
          <section>
            <h2>Shops on today&apos;s beat</h2>
            <p className="sub">Add your own number to a shop to get its call. Anyone ringing the agent from an unknown number becomes a demo copy of Sri Lakshmi Stores.</p>
            <table className="table">
              <thead>
                <tr><th>Shop</th><th>Last order</th><th>Credit due</th><th>Today</th><th>Phone</th></tr>
              </thead>
              <tbody>
                {data.shops.map((shop) => (
                  <ShopRow key={shop.id} shop={shop} canCall={data.can_call} busy={busy === `call-${shop.id}`}
                    onCall={() => startBeat([shop.id])} onSavePhone={(p) => savePhone(shop.id, p)} />
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h2>Calls</h2>
            <p className="sub">Open a call to read the transcript and play the recording.</p>
            {data.calls.length === 0 && <p className="dim">No calls yet. They show up here as soon as one starts.</p>}
            <div className="calls">
              {data.calls.map((c) => (
                <div className="call" key={c.execution_id}>
                  <button aria-expanded={open === c.execution_id} onClick={() => setOpen(open === c.execution_id ? null : c.execution_id)}>
                    <b>{shopLabel(c.shop_name, c.is_demo_caller, c.phone)}</b>
                    <CallState status={c.status} outcome={c.outcome} />
                    <span className="line2">
                      {c.direction === "inbound" ? "Shop called in" : c.direction === "outbound" ? "Agent called the shop" : "Call"}
                      {" · "}{ago(c.started_at)}{c.duration_sec ? ` · ${Math.floor(c.duration_sec / 60)}m ${c.duration_sec % 60}s` : ""}
                    </span>
                  </button>
                  {open === c.execution_id && (
                    <div className="transcript">
                      {c.recording_url && <audio controls preload="none" src={c.recording_url} />}
                      {c.transcript || "The transcript arrives when the call ends."}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {(data.promises.length > 0 || data.callbacks.length > 0) && (
            <section>
              <h2>Payment promises and callbacks</h2>
              <p className="sub">What shops committed to on overdue credit, and who asked to be called later.</p>
              <div className="promises">
                {data.promises.map((p) => (
                  <div className="promise" key={`p${p.id}`}>
                    <span>{shopLabel(p.shop_name, p.is_demo_caller, p.phone)}</span>
                    <span><b>{inr(p.amount)}</b> on {shortDate(p.promise_date)}</span>
                  </div>
                ))}
                {data.callbacks.map((b) => (
                  <div className="promise" key={`b${b.id}`}>
                    <span>{b.shop_name}</span>
                    <span>Call back {b.callback_at ? new Date(b.callback_at).toLocaleString("en-IN", { weekday: "short", hour: "numeric", minute: "2-digit" }) : b.note}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

function CallState({ status, outcome }: { status: string; outcome: string | null }) {
  if (LIVE.has(status) && !outcome) return <span className="state calling">{status === "in-progress" ? "On the call" : "Ringing"}</span>;
  if (outcome === "ordered") return <span className="state ordered">Ordered</span>;
  if (outcome === "promised") return <span className="state promised">Promised payment</span>;
  if (outcome === "callback") return <span className="state promised">Call back later</span>;
  if (LIVE.has(status)) return <span className="state calling">On the call</span>;
  if (status === "completed") return <span className="state none">No order</span>;
  return <span className="state none">{status.replace(/[-_]/g, " ")}</span>;
}

function ShopRow({ shop, canCall, busy, onCall, onSavePhone }: {
  shop: Shop; canCall: boolean; busy: boolean; onCall: () => void; onSavePhone: (p: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const overdue = shop.credit_due_since ? Math.round((Date.now() - new Date(`${shop.credit_due_since}T00:00:00+05:30`).getTime()) / 86_400_000) : null;

  let today: React.ReactNode = <span className="state none">Not called</span>;
  if (shop.call_status) {
    if (LIVE.has(shop.call_status) && !shop.call_outcome) today = <span className="state calling">{shop.call_status === "in-progress" ? "On the call" : "Ringing"}</span>;
    else if (shop.call_outcome === "ordered") today = <span className="state ordered">Ordered {shop.last_source === "call" && shop.last_total ? inr(shop.last_total) : ""}</span>;
    else if (shop.call_outcome === "promised") today = <span className="state promised">Promised payment</span>;
    else if (shop.call_outcome === "callback") today = <span className="state promised">Call back later</span>;
    else today = <span className="state none">{shop.call_status === "completed" ? "No order" : shop.call_status.replace(/[-_]/g, " ")}</span>;
  }

  return (
    <tr>
      <td className="shop">
        <b>{shop.name}</b>
        <small>{shop.is_demo_caller ? `Demo caller ${tail(shop.phone)}` : `${shop.owner_name}, ${shop.area}`}</small>{" "}
        <span className="lang">{LANG[shop.language] ?? shop.language}</span>
      </td>
      <td>{shop.last_total ? <>{inr(shop.last_total)}<div className="dim">{ago(shop.last_order_at)}{shop.last_source === "call" ? ", on a call" : ", by salesman"}</div></> : <span className="dim">None</span>}</td>
      <td>{shop.credit_due > 0 ? <><span className="due">{inr(shop.credit_due)}</span><div className="dim">{overdue} days overdue</div>{shop.promise_amount && shop.promise_date ? <div className="dim">{inr(shop.promise_amount)} promised for {shortDate(shop.promise_date)}</div> : null}</> : <span className="dim">Clear</span>}</td>
      <td>{today}</td>
      <td>
        {shop.is_demo_caller ? (
          <span className="dim">{tail(shop.phone)}</span>
        ) : editing || !shop.dialable ? (
          <form className="phone-edit" onSubmit={(e) => { e.preventDefault(); onSavePhone(value); setEditing(false); }}>
            <input aria-label={`Phone number for ${shop.name}`} inputMode="numeric" placeholder="Your 10-digit no." value={value} onChange={(e) => setValue(e.target.value)} />
            <button className="btn small" type="submit" disabled={value.replace(/\D/g, "").length < 10}>Save</button>
          </form>
        ) : (
          <div className="phone-edit">
            <button className="btn small" onClick={onCall} disabled={!canCall || busy}>{busy ? "Calling…" : "Call now"}</button>
            <button className="btn small" onClick={() => { setValue(shop.phone ?? ""); setEditing(true); }} aria-label={`Change number for ${shop.name}`}>{tail(shop.phone)}</button>
          </div>
        )}
      </td>
    </tr>
  );
}

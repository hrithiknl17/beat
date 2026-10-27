"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight, Bell, Check, ChevronDown, Clock3, CreditCard, FileText, Headphones, Mic, Package, Phone, Play, Search, Store, Volume2, WalletCards,
} from "lucide-react";
import { ago, clock, dayTime, duration, inr, initials, isToday, overdueDays, shortDate, tail, tone, useBeat, type Data } from "@/components/data";
import { CallState, Loading, OrderSlip, PageHead } from "@/components/ui";
import { langName } from "@/lib/lang";

export default function LiveBeat() {
  const { data, act, notify } = useBeat();
  const [busy, setBusy] = useState("");
  const [query, setQuery] = useState("");
  const [openCall, setOpenCall] = useState<string | null>(null);
  const { fresh } = useBeat();

  const shops = useMemo(() => {
    const s = query.trim().toLowerCase();
    return (data?.shops ?? []).filter((x) => !s || `${x.name} ${x.area} ${x.owner_name}`.toLowerCase().includes(s));
  }, [data, query]);

  if (!data) return <Loading />;
  const { stats } = data;
  const todayOrders = data.orders.filter((o) => o.source === "call" && o.status !== "cancelled" && isToday(o.created_at)).slice(0, 5);
  const openPromises = data.promises.filter((p) => p.status === "open").slice(0, 4);
  const pendingCallbacks = data.callbacks.filter((c) => c.status === "pending").slice(0, 3);
  const reachPct = stats.active_shops ? Math.round((stats.shops_called / stats.active_shops) * 100) : 0;

  async function call(shopIds?: number[]) {
    setBusy(shopIds ? `call-${shopIds[0]}` : "beat");
    const out = await act<{ results: { shop: string; ok: boolean; reason?: string }[] }>("/api/beat", "POST", { shop_ids: shopIds });
    setBusy("");
    if (!out) return;
    const placed = out.results.filter((r) => r.ok).map((r) => r.shop);
    const skipped = out.results.filter((r) => !r.ok);
    notify(
      [placed.length ? `Calling ${placed.join(", ")}.` : "No calls placed.", ...skipped.slice(0, 3).map((r) => `${r.shop}: ${r.reason}.`)].join(" "),
      !placed.length,
    );
  }

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).toUpperCase();

  return (
    <>
      <PageHead eyebrow={today} title="Live beat" live sub="Watch orders come in as Beat talks to your shops.">
        <button className="button primary" onClick={() => call()} disabled={!data.can_call || busy === "beat" || !stats.active_shops}
          title={data.can_call ? "Call every active shop now" : "Add your Bolna keys to switch on outbound calls"}>
          <Mic /> {busy === "beat" ? "Starting…" : "Start beat"} <ArrowUpRight />
        </button>
      </PageHead>

      <Onboarding data={data} />

      <section className="stats-grid" aria-label="Today's numbers">
        <Stat icon={<FileText />} accent="orange" label="Orders today" value={String(stats.orders)} sub={`${stats.open_orders} waiting to be delivered`} />
        <Stat icon={<WalletCards />} accent="violet" label="Booked today" value={inr(stats.booked)} sub="from calls" />
        <Stat icon={<CreditCard />} accent="teal" label="Payment promised" value={inr(stats.promised)} sub={`${inr(stats.collected)} collected today`} />
        <Stat icon={<Phone />} accent="blue" label="Shops reached" value={`${stats.shops_called} / ${stats.active_shops}`} sub={`${stats.calls} calls today`} ring={reachPct} />
      </section>

      <div className="section-heading">
        <div><h2>Orders arriving live</h2><p>Fresh slips from today&apos;s calls</p></div>
        <Link className="text-button" href="/app/orders">All orders <ArrowUpRight /></Link>
      </div>
      <section className="orders-grid" aria-label="Today's orders">
        {todayOrders.map((o) => <OrderSlip key={o.id} order={o} fresh={fresh.has(o.id)} delivery={data.me.delivery_note} />)}
        <div className="order-empty">
          <div className="empty-icon"><Headphones /></div>
          <b>{todayOrders.length ? "Beat is listening" : "No orders yet today"}</b>
          <p>{data.can_call ? "Press Start beat, or wait for a shop to ring in. Orders print here the moment they're booked." : "Shops can ring your Beat number. Orders print here the moment they're booked."}</p>
          <div className="mini-wave"><span /><span /><span /><span /><span /><span /><span /></div>
        </div>
      </section>

      <section className="lower-grid">
        <div className="panel">
          <div className="panel-header">
            <div><h2>Shops on today&apos;s beat</h2><p>{stats.active_shops} active shops · {stats.shops_called} reached today</p></div>
            <div className="search-box"><Search /><input placeholder="Search shops" aria-label="Search shops" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
          </div>
          {shops.length === 0 ? (
            <p className="panel-empty">{data.shops.length ? "No shop matches that search." : <>No shops yet. <Link href="/app/shops">Add your first shop</Link>.</>}</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>SHOP</th><th>LAST ORDER</th><th>CREDIT DUE</th><th>TODAY</th><th /></tr></thead>
                <tbody>
                  {shops.map((s) => {
                    const days = overdueDays(s.credit_due_since);
                    return (
                      <tr key={s.id} className={s.status === "paused" ? "dim-row" : ""}>
                        <td>
                          <div className="shop-cell">
                            <div className={`shop-avatar ${tone(s.id)}`}>{initials(s.name)}</div>
                            <div>
                              <b>{s.name}</b>
                              <span>{[s.owner_name, s.area].filter(Boolean).join(" · ") || tail(s.phone)}</span>
                              <em>{langName(s.language)}</em>{s.status === "new" && <em className="new-tag">New caller</em>}{s.status === "paused" && <em>Paused</em>}
                            </div>
                          </div>
                        </td>
                        <td>{s.last_total ? <><b>{inr(s.last_total)}</b><span>{ago(s.last_order_at)}, {s.last_source === "call" ? "on a call" : "by salesman"}</span></> : <span>None yet</span>}</td>
                        <td className={s.credit_due > 0 ? "due" : "clear"}>
                          <b>{s.credit_due > 0 ? inr(s.credit_due) : "Clear"}</b>
                          <span>{s.credit_due > 0 ? (s.promise_amount && s.promise_date ? `${inr(s.promise_amount)} promised ${shortDate(s.promise_date)}` : `${days ?? 0} days overdue`) : "Nothing owed"}</span>
                        </td>
                        <td><CallState status={s.call_status} outcome={s.call_outcome} /></td>
                        <td>
                          <button className="call-button" onClick={() => call([s.id])}
                            disabled={!data.can_call || !s.dialable || s.status === "paused" || busy === `call-${s.id}`}
                            title={!s.dialable ? "Add this shop's real number on the Shops page" : `Call ${s.name}`}>
                            <Phone /> {busy === `call-${s.id}` ? "Calling…" : "Call now"}
                          </button>
                        </td>
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
            <div className="panel-header">
              <div><h2>Recent calls</h2><p>What Beat said and heard</p></div>
              <Link className="text-button" href="/app/calls">All <ArrowUpRight /></Link>
            </div>
            <div className="calls-list">
              {data.calls.length === 0 && <p className="panel-empty">No calls yet. They show up here the moment one starts.</p>}
              {data.calls.slice(0, 5).map((c) => (
                <div className={`call-row ${openCall === c.execution_id ? "expanded" : ""}`} key={c.execution_id}>
                  <button className="call-summary" aria-expanded={openCall === c.execution_id} onClick={() => setOpenCall(openCall === c.execution_id ? null : c.execution_id)}>
                    <div className="call-icon"><Volume2 /></div>
                    <div className="call-info">
                      <b>{c.shop_name ?? "Unknown number"}</b>
                      <span>{c.direction === "inbound" ? "Shop rang in" : "Beat called"} · {ago(c.started_at)}{c.duration_sec ? ` · ${duration(c.duration_sec)}` : ""}</span>
                    </div>
                    <CallState status={c.status} outcome={c.outcome} />
                    <ChevronDown />
                  </button>
                  {openCall === c.execution_id && (
                    <div className="call-detail">
                      {c.recording_url ? <audio controls preload="none" src={c.recording_url} /> : <div className="audio-placeholder"><Play /> Recording arrives when the call ends</div>}
                      <div className="transcript"><span>TRANSCRIPT</span>{c.transcript ? c.transcript.split("\n").filter(Boolean).map((l, i) => <p key={i}>{l}</p>) : <p>The transcript arrives when the call ends.</p>}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div><h2>Promises &amp; callbacks</h2><p>Things to follow up</p></div>
              <Bell className="panel-icon" />
            </div>
            {openPromises.length === 0 && pendingCallbacks.length === 0 && <p className="panel-empty">Nothing to follow up right now.</p>}
            {openPromises.map((p) => {
              const missed = p.promise_date < new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
              return (
                <Link href="/app/payments" className="promise-item" key={`p${p.id}`}>
                  <div className={`promise-icon ${missed ? "missed" : "money"}`}>₹</div>
                  <div><b>{p.shop_name}</b><span>{inr(p.amount)} · {missed ? "missed " : ""}{shortDate(p.promise_date)}</span></div>
                  <ArrowUpRight />
                </Link>
              );
            })}
            {pendingCallbacks.map((b) => (
              <Link href="/app/payments" className="promise-item" key={`b${b.id}`}>
                <div className="promise-icon callback"><Clock3 /></div>
                <div><b>{b.shop_name}</b><span>Call back {b.callback_at ? dayTime(b.callback_at) : b.note}</span></div>
                <ArrowUpRight />
              </Link>
            ))}
          </div>
        </div>
      </section>
      <footer><span>Beat is powered by Bolna voice AI</span><span>All times in IST · updated {clock(new Date().toISOString())}</span></footer>
    </>
  );
}

function Stat({ icon, label, value, sub, accent, ring }: { icon: React.ReactNode; label: string; value: string; sub: string; accent: string; ring?: number }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${accent}`}>{icon}</div>
      <div className="stat-copy"><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>
      {ring !== undefined && <div className="progress-ring" style={{ "--pct": `${ring}%` } as React.CSSProperties}><span>{ring}%</span></div>}
    </div>
  );
}

/** First-run checklist. Disappears once the account can take a real call. */
function Onboarding({ data }: { data: Data }) {
  const { act, notify } = useBeat();
  const [busy, setBusy] = useState("");
  const hasProducts = data.products.length > 0;
  const hasShops = data.shops.length > 0;
  const hasRealNumber = data.shops.some((s) => s.dialable);
  const hasBeatNumber = Boolean(data.me.phone_number);
  if (hasProducts && hasShops && hasRealNumber && hasBeatNumber) return null;

  async function load(what: "catalog" | "shops") {
    setBusy(what);
    const out = await act<{ added: number }>("/api/onboarding", "POST", { load: what });
    setBusy("");
    if (out) notify(what === "catalog" ? `Added ${out.added} products. Edit prices on the Products page.` : `Added ${out.added} shops with last week's orders.`);
  }

  const steps = [
    { done: hasProducts, icon: <Package />, title: "Set up your catalog", text: "Products, pack sizes, prices and schemes the agent sells from.",
      action: <><button className="button primary small" disabled={busy === "catalog"} onClick={() => load("catalog")}>Load starter catalog</button><Link className="text-button" href="/app/products">Add my own</Link></> },
    { done: hasShops, icon: <Store />, title: "Add the shops on your beat", text: "Name, owner, area, number and the language they speak.",
      action: <><Link className="button primary small" href="/app/shops">Add shops</Link><button className="text-button" disabled={busy === "shops"} onClick={() => load("shops")}>Use 5 sample shops</button></> },
    { done: hasRealNumber, icon: <Phone />, title: "Put a real number on a shop", text: "Use your own mobile to hear exactly what your shops will hear.",
      action: <Link className="button secondary small" href="/app/shops">Open shops</Link> },
    { done: hasBeatNumber, icon: <Headphones />, title: "Connect your Beat number", text: "The Bolna number shops ring. Calls to it land in this account.",
      action: <Link className="button secondary small" href="/app/settings">Open settings</Link> },
  ];
  return (
    <section className="onboarding panel">
      <div className="panel-header"><div><h2>Get Beat ready for your route</h2><p>{steps.filter((s) => s.done).length} of {steps.length} done</p></div></div>
      <ol>
        {steps.map((s) => (
          <li key={s.title} className={s.done ? "done" : ""}>
            <div className="step-icon">{s.done ? <Check /> : s.icon}</div>
            <div><b>{s.title}</b><span>{s.text}</span></div>
            {!s.done && <div className="step-action">{s.action}</div>}
          </li>
        ))}
      </ol>
    </section>
  );
}

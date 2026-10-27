"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export type Line = { code: string; name: string; pack: string; qty: number; price: number; off: number; total: number };
export type Me = { id: number; name: string; owner_name: string; email: string; city: string; phone_number: string | null; delivery_note: string };
export type Shop = {
  id: number; name: string; owner_name: string; phone: string | null; area: string; language: string;
  credit_due: number; credit_due_since: string | null; status: string; notes: string | null; dialable: boolean;
  last_total: number | null; last_order_at: string | null; last_source: string | null;
  call_status: string | null; call_outcome: string | null; call_at: string | null;
  promise_amount: number | null; promise_date: string | null;
};
export type Order = {
  id: number; shop_id: number; shop_name: string; area: string; phone: string | null; lines: Line[];
  subtotal: number; discount: number; total: number; source: string; status: string;
  paid_by: string | null; delivered_at: string | null; created_at: string; execution_id: string | null;
};
export type Call = {
  execution_id: string; shop_id: number | null; shop_name: string | null; phone: string | null; shop_status: string | null;
  direction: string | null; purpose: string; status: string; outcome: string | null; started_at: string;
  ended_at: string | null; duration_sec: number | null; transcript: string | null; recording_url: string | null;
};
export type PaymentPromise = { id: number; shop_id: number; shop_name: string; amount: number; promise_date: string; status: string; created_at: string };
export type Callback = { id: number; shop_id: number; shop_name: string; callback_at: string | null; note: string | null; status: string; created_at: string };
export type Payment = { id: number; shop_id: number; shop_name: string; amount: number; method: string; note: string | null; received_at: string };
export type Product = {
  id: number; code: string; name: string; pack: string; price: number;
  scheme_min_qty: number | null; scheme_off: number | null; scheme_note: string | null;
  is_new: boolean; in_stock: boolean; substitute: string | null;
};
export type Stats = {
  orders: number; booked: number; promised: number; calls: number; shops_called: number;
  active_shops: number; outstanding: number; collected: number; open_orders: number;
};
export type Data = {
  me: Me; can_call: boolean; agent_languages: string[]; stats: Stats;
  shops: Shop[]; orders: Order[]; calls: Call[]; promises: PaymentPromise[];
  callbacks: Callback[]; payments: Payment[]; products: Product[];
};

type Notice = { id: number; text: string; error?: boolean };

type Ctx = {
  data: Data | null;
  error: string;
  reload: () => Promise<void>;
  /** Calls a dashboard API. Shows the server's error as a toast and returns null on failure; reloads data on success. */
  act: <T = Record<string, unknown>>(path: string, method: string, body?: unknown) => Promise<T | null>;
  notify: (text: string, error?: boolean) => void;
  notices: Notice[];
  dismiss: (id: number) => void;
  /** Order ids that arrived while the page was open, for the print-in animation. */
  fresh: Set<number>;
};

const BeatContext = createContext<Ctx | null>(null);

export function useBeat() {
  const ctx = useContext(BeatContext);
  if (!ctx) throw new Error("useBeat must be used inside <BeatProvider>");
  return ctx;
}

export function BeatProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [notices, setNotices] = useState<Notice[]>([]);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const seen = useRef<Set<number> | null>(null);
  const noticeId = useRef(0);

  const notify = useCallback((text: string, isError?: boolean) => {
    const id = ++noticeId.current;
    setNotices((n) => [...n.slice(-2), { id, text, error: isError }]);
    setTimeout(() => setNotices((n) => n.filter((x) => x.id !== id)), isError ? 7000 : 4000);
  }, []);
  const dismiss = useCallback((id: number) => setNotices((n) => n.filter((x) => x.id !== id)), []);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      if (res.status === 401) { window.location.href = "/login"; return; }
      if (!res.ok) throw new Error(`Couldn't load your data (${res.status}). Retrying…`);
      const d: Data = await res.json();
      if (seen.current) {
        const added = d.orders.filter((o) => !seen.current!.has(o.id)).map((o) => o.id);
        if (added.length) setFresh(new Set(added));
      }
      seen.current = new Set(d.orders.map((o) => o.id));
      setData(d);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    reload();
    // Poll fast while someone is watching, and not at all from a background tab.
    const t = setInterval(() => { if (document.visibilityState === "visible") reload(); }, 3000);
    const onFocus = () => reload();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, [reload]);

  const act = useCallback(async <T,>(path: string, method: string, body?: unknown): Promise<T | null> => {
    try {
      const res = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const out = await res.json().catch(() => ({}));
      if (res.status === 401 && path !== "/api/auth/login") { window.location.href = "/login"; return null; }
      if (!res.ok) { notify(out.error ?? `Something went wrong (${res.status}).`, true); return null; }
      reload();
      return out as T;
    } catch {
      notify("You seem to be offline. Check your connection and try again.", true);
      return null;
    }
  }, [notify, reload]);

  return (
    <BeatContext.Provider value={{ data, error, reload, act, notify, notices, dismiss, fresh }}>
      {children}
    </BeatContext.Provider>
  );
}

// ---------- formatting ----------

export const inr = (n: number | null | undefined) => `₹${Number(n ?? 0).toLocaleString("en-IN")}`;

export function ago(iso: string | null) {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 50) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  const d = Math.round(s / 86400);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

const asDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00+05:30` : iso);
export const shortDate = (iso: string) => asDate(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
export const clock = (iso: string) => asDate(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
export const dayTime = (iso: string) => asDate(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

export function istToday() {
  return new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
}
export const isToday = (iso: string) => asDate(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) === istToday();

export const tail = (phone: string | null) => (phone ? `••${phone.slice(-4)}` : "");
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
const TONES = ["saffron", "violet", "blue", "teal", "rose"];
export const tone = (id: number) => TONES[id % TONES.length];
export const duration = (sec: number | null) => (sec ? `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, "0")}s` : "");
export function overdueDays(since: string | null) {
  if (!since) return null;
  return Math.max(0, Math.round((Date.now() - asDate(since).getTime()) / 86_400_000));
}

export const LIVE = new Set(["queued", "scheduled", "initiated", "ringing", "in-progress", "in_progress"]);

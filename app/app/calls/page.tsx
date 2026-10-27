"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Phone, PhoneIncoming, PhoneOutgoing, Play, Search } from "lucide-react";
import { ago, dayTime, duration, LIVE, useBeat } from "@/components/data";
import { CallState, Empty, Loading, PageHead, Tabs } from "@/components/ui";

type Filter = "all" | "live" | "ordered" | "promised" | "callback" | "none";

const isLive = (c: { status: string; ended_at: string | null }) => LIVE.has(c.status) && !c.ended_at;
const match = (c: { status: string; outcome: string | null; ended_at: string | null }, f: Filter) =>
  f === "all" || (f === "live" ? isLive(c) : f === "none" ? !isLive(c) && (!c.outcome || c.outcome === "no_order") : c.outcome === f);

export default function Calls() {
  const { data } = useBeat();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const list = useMemo(() => {
    const s = query.trim().toLowerCase();
    return (data?.calls ?? []).filter((c) => match(c, filter) && (!s || `${c.shop_name ?? ""} ${c.transcript ?? ""}`.toLowerCase().includes(s)));
  }, [data, filter, query]);

  if (!data) return <Loading />;
  const n = (f: Filter) => data.calls.filter((c) => match(c, f)).length;

  return (
    <>
      <PageHead title="Calls" sub="Every conversation Beat had, with the recording and transcript." />
      <div className="toolbar">
        <Tabs value={filter} onChange={setFilter} options={[
          { value: "all", label: "All", count: data.calls.length },
          { value: "live", label: "Live now", count: n("live") },
          { value: "ordered", label: "Ordered", count: n("ordered") },
          { value: "promised", label: "Promised payment", count: n("promised") },
          { value: "callback", label: "Call back", count: n("callback") },
          { value: "none", label: "No order", count: n("none") },
        ]} />
        <div className="search-box"><Search /><input placeholder="Shop or words said" aria-label="Search calls" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
      </div>

      {list.length === 0 ? (
        <Empty icon={<Phone />} title={data.calls.length ? "No calls match" : "No calls yet"}>
          <p>{data.calls.length ? "Try another tab." : "Start the beat, or ring your Beat number from a phone."}</p>
        </Empty>
      ) : (
        <div className="panel calls-list full">
          {list.map((c) => (
            <div className={`call-row ${open === c.execution_id ? "expanded" : ""}`} key={c.execution_id}>
              <button className="call-summary" aria-expanded={open === c.execution_id} onClick={() => setOpen(open === c.execution_id ? null : c.execution_id)}>
                <div className="call-icon">{c.direction === "inbound" ? <PhoneIncoming /> : <PhoneOutgoing />}</div>
                <div className="call-info">
                  <b>{c.shop_name ?? "Unknown number"}{c.shop_status === "new" ? " · new caller" : ""}</b>
                  <span>
                    {c.direction === "inbound" ? "Shop rang in" : c.purpose === "callback" ? "Callback" : "Beat called"} · {dayTime(c.started_at)} ({ago(c.started_at)})
                    {c.duration_sec ? ` · ${duration(c.duration_sec)}` : ""}
                  </span>
                </div>
                <CallState status={c.status} outcome={c.outcome} />
                <ChevronDown />
              </button>
              {open === c.execution_id && (
                <div className="call-detail">
                  {c.recording_url ? <audio controls preload="none" src={c.recording_url} /> : <div className="audio-placeholder"><Play /> {isLive(c) ? "Call in progress" : "No recording for this call"}</div>}
                  <div className="transcript">
                    <span>TRANSCRIPT</span>
                    {c.transcript ? c.transcript.split("\n").filter(Boolean).map((l, i) => <p key={i}>{l}</p>) : <p>{isLive(c) ? "The transcript arrives when the call ends." : "No transcript was sent for this call."}</p>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

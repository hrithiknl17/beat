"use client";

import { useMemo, useState } from "react";
import { Pause, Pencil, Phone, Play, Plus, Search, Store, Trash2 } from "lucide-react";
import { ago, inr, initials, overdueDays, tail, tone, useBeat, type Shop } from "@/components/data";
import { CallState, Empty, Field, Loading, Modal, PageHead, Tabs } from "@/components/ui";
import { LANG_CODES, LANGUAGES, langName } from "@/lib/lang";

type Filter = "all" | "new" | "owing" | "paused";
type Form = { name: string; owner_name: string; phone: string; area: string; language: string; credit_due: string; notes: string };
const blank: Form = { name: "", owner_name: "", phone: "", area: "", language: "kn", credit_due: "", notes: "" };

export default function Shops() {
  const { data, act, notify } = useBeat();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ id: number | null; form: Form } | null>(null);
  const [busy, setBusy] = useState("");

  const list = useMemo(() => {
    const s = query.trim().toLowerCase();
    return (data?.shops ?? []).filter((x) =>
      (filter === "all" || (filter === "owing" ? x.credit_due > 0 : x.status === filter)) &&
      (!s || `${x.name} ${x.owner_name} ${x.area} ${x.phone ?? ""}`.toLowerCase().includes(s)));
  }, [data, filter, query]);

  if (!data) return <Loading />;

  const open = (s?: Shop) => setEditing(s
    ? { id: s.id, form: { name: s.status === "new" && s.name === "New shop" ? "" : s.name, owner_name: s.owner_name, phone: s.phone ?? "", area: s.area, language: s.language, credit_due: s.credit_due ? String(s.credit_due) : "", notes: s.notes ?? "" } }
    : { id: null, form: blank });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy("save");
    const wasNew = editing.id !== null && data?.shops.find((s) => s.id === editing.id)?.status === "new";
    const out = editing.id === null
      ? await act("/api/shops", "POST", editing.form)
      : await act(`/api/shops/${editing.id}`, "PATCH", { ...editing.form, ...(wasNew ? { status: "active" } : {}) });
    setBusy("");
    if (out) { notify(editing.id === null ? `${editing.form.name} added to your beat.` : "Shop saved."); setEditing(null); }
  }

  async function call(s: Shop) {
    setBusy(`call-${s.id}`);
    const out = await act<{ results: { ok: boolean; reason?: string }[] }>("/api/beat", "POST", { shop_ids: [s.id] });
    setBusy("");
    const r = out?.results[0];
    if (r) notify(r.ok ? `Calling ${s.name}…` : `${s.name}: ${r.reason}.`, !r.ok);
  }

  async function remove(s: Shop) {
    if (!window.confirm(`Delete ${s.name}? Its orders, calls and payment history are deleted too. This can't be undone.`)) return;
    if (await act(`/api/shops/${s.id}`, "DELETE")) notify(`${s.name} deleted.`);
  }

  const f = editing?.form;
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setEditing((x) => x && { ...x, form: { ...x.form, [k]: e.target.value } });
  const n = (fl: Filter) => data.shops.filter((x) => fl === "all" || (fl === "owing" ? x.credit_due > 0 : x.status === fl)).length;

  return (
    <>
      <PageHead title="Shops" sub="The kirana stores on your beat. Beat calls each one in its own language.">
        <button className="button primary" onClick={() => open()}><Plus /> Add shop</button>
      </PageHead>
      <div className="toolbar">
        <Tabs value={filter} onChange={setFilter} options={[
          { value: "all", label: "All", count: n("all") },
          { value: "new", label: "New callers", count: n("new") },
          { value: "owing", label: "Owe money", count: n("owing") },
          { value: "paused", label: "Paused", count: n("paused") },
        ]} />
        <div className="search-box"><Search /><input placeholder="Name, area or number" aria-label="Search shops" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
      </div>

      {list.length === 0 ? (
        <Empty icon={<Store />} title={data.shops.length ? "No shops match" : "No shops yet"}>
          <p>{data.shops.length ? "Try another tab or search." : "Add the shops on your route. Shops that ring your Beat number are added here automatically."}</p>
          {!data.shops.length && <button className="button primary" onClick={() => open()}><Plus /> Add shop</button>}
        </Empty>
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table>
              <thead><tr><th>SHOP</th><th>PHONE</th><th>LAST ORDER</th><th>CREDIT DUE</th><th>TODAY</th><th /></tr></thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id} className={s.status === "paused" ? "dim-row" : s.status === "new" ? "new-row" : ""}>
                    <td>
                      <div className="shop-cell">
                        <div className={`shop-avatar ${tone(s.id)}`}>{initials(s.name)}</div>
                        <div>
                          <b>{s.name}</b>
                          <span>{[s.owner_name, s.area].filter(Boolean).join(" · ") || "Details not added yet"}</span>
                          <em>{langName(s.language)}</em>{s.status === "new" && <em className="new-tag">Rang in · check details</em>}{s.status === "paused" && <em>Paused</em>}
                        </div>
                      </div>
                    </td>
                    <td>{s.dialable ? <b>{s.phone}</b> : <><b className="muted">{s.phone ? tail(s.phone) : "—"}</b><span>{s.phone ? "Sample number, can't be called" : "No number"}</span></>}</td>
                    <td>{s.last_total ? <><b>{inr(s.last_total)}</b><span>{ago(s.last_order_at)}</span></> : <span>None yet</span>}</td>
                    <td className={s.credit_due > 0 ? "due" : "clear"}><b>{s.credit_due > 0 ? inr(s.credit_due) : "Clear"}</b>{s.credit_due > 0 && <span>{overdueDays(s.credit_due_since) ?? 0} days</span>}</td>
                    <td><CallState status={s.call_status} outcome={s.call_outcome} /></td>
                    <td>
                      <div className="row-actions">
                        <button className="call-button" onClick={() => call(s)} disabled={!data.can_call || !s.dialable || s.status === "paused" || busy === `call-${s.id}`}
                          title={!data.can_call ? "Calling isn't switched on yet" : !s.dialable ? "Add a real number first" : `Call ${s.name}`}>
                          <Phone /> {busy === `call-${s.id}` ? "Calling…" : "Call"}
                        </button>
                        <button className="icon-button" aria-label={`Edit ${s.name}`} title="Edit" onClick={() => open(s)}><Pencil /></button>
                        {s.status !== "new" && (
                          <button className="icon-button" aria-label={s.status === "paused" ? `Resume ${s.name}` : `Pause ${s.name}`} title={s.status === "paused" ? "Resume calls" : "Pause calls"}
                            onClick={() => act(`/api/shops/${s.id}`, "PATCH", { status: s.status === "paused" ? "active" : "paused" })}>
                            {s.status === "paused" ? <Play /> : <Pause />}
                          </button>
                        )}
                        <button className="icon-button danger" aria-label={`Delete ${s.name}`} title="Delete" onClick={() => remove(s)}><Trash2 /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && f && (
        <Modal title={editing.id === null ? "Add a shop" : `Edit ${data.shops.find((s) => s.id === editing.id)?.name ?? "shop"}`} onClose={() => setEditing(null)}>
          <form className="form-grid" onSubmit={save}>
            <Field label="Shop name"><input required value={f.name} onChange={set("name")} placeholder="Sri Lakshmi Stores" /></Field>
            <Field label="Owner's name" hint="Beat greets them by first name."><input value={f.owner_name} onChange={set("owner_name")} placeholder="Ramesh Gowda" /></Field>
            <Field label="Mobile number" hint="10 digits. Beat calls this number."><input inputMode="numeric" value={f.phone} onChange={set("phone")} placeholder="98450 12345" /></Field>
            <Field label="Area"><input value={f.area} onChange={set("area")} placeholder="Basavanagudi" /></Field>
            <Field label="Call language">
              <select value={f.language} onChange={set("language")}>
                {LANG_CODES.map((c) => <option key={c} value={c}>{LANGUAGES[c]}{data.agent_languages.length && !data.agent_languages.includes(c) ? " (no agent yet)" : ""}</option>)}
              </select>
            </Field>
            <Field label="Credit due (₹)" hint="What they owe you today."><input inputMode="numeric" value={f.credit_due} onChange={set("credit_due")} placeholder="0" /></Field>
            <Field label="Notes" span><textarea rows={2} value={f.notes} onChange={set("notes")} placeholder="Closed on Sundays, prefers calls after 4 PM…" /></Field>
            <div className="modal-actions span">
              <button type="button" className="button secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="button primary" disabled={busy === "save"}>{busy === "save" ? "Saving…" : editing.id === null ? "Add shop" : "Save"}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

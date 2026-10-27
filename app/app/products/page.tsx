"use client";

import { useMemo, useState } from "react";
import { Package, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { inr, useBeat, type Product } from "@/components/data";
import { Empty, Field, Loading, Modal, PageHead, Tabs } from "@/components/ui";

type Filter = "all" | "out" | "scheme" | "new";
type Form = { code: string; name: string; pack: string; price: string; scheme_min_qty: string; scheme_off: string; scheme_note: string; is_new: boolean; in_stock: boolean; substitute: string };
const blank: Form = { code: "", name: "", pack: "", price: "", scheme_min_qty: "", scheme_off: "", scheme_note: "", is_new: false, in_stock: true, substitute: "" };

export default function Products() {
  const { data, act, notify } = useBeat();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ id: number | null; form: Form } | null>(null);
  const [busy, setBusy] = useState(false);

  const list = useMemo(() => {
    const s = query.trim().toLowerCase();
    return (data?.products ?? []).filter((p) =>
      (filter === "all" || (filter === "out" ? !p.in_stock : filter === "scheme" ? Boolean(p.scheme_note) : p.is_new)) &&
      (!s || `${p.code} ${p.name}`.toLowerCase().includes(s)));
  }, [data, filter, query]);

  if (!data) return <Loading />;

  const open = (p?: Product) => setEditing(p
    ? { id: p.id, form: { code: p.code, name: p.name, pack: p.pack, price: String(p.price), scheme_min_qty: p.scheme_min_qty ? String(p.scheme_min_qty) : "", scheme_off: p.scheme_off ? String(p.scheme_off) : "", scheme_note: p.scheme_note ?? "", is_new: p.is_new, in_stock: p.in_stock, substitute: p.substitute ?? "" } }
    : { id: null, form: blank });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    const out = editing.id === null ? await act("/api/products", "POST", editing.form) : await act(`/api/products/${editing.id}`, "PATCH", editing.form);
    setBusy(false);
    if (out) { notify(editing.id === null ? `${editing.form.name} added. The agent can sell it on the next call.` : "Product saved."); setEditing(null); }
  }

  async function toggleStock(p: Product) {
    if (await act(`/api/products/${p.id}`, "PATCH", { in_stock: !p.in_stock })) {
      notify(p.in_stock ? `${p.name} marked out of stock.${p.substitute ? "" : " Set a substitute so Beat can offer one."}` : `${p.name} back in stock.`);
    }
  }

  async function remove(p: Product) {
    if (!window.confirm(`Remove ${p.name} from your catalog? Past orders keep it.`)) return;
    if (await act(`/api/products/${p.id}`, "DELETE")) notify(`${p.name} removed.`);
  }

  async function loadStarter() {
    const out = await act<{ added: number }>("/api/onboarding", "POST", { load: "catalog" });
    if (out) notify(`Added ${out.added} products.`);
  }

  const f = editing?.form;
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setEditing((x) => x && { ...x, form: { ...x.form, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value } });
  const n = (fl: Filter) => data.products.filter((p) => fl === "all" || (fl === "out" ? !p.in_stock : fl === "scheme" ? Boolean(p.scheme_note) : p.is_new)).length;

  return (
    <>
      <PageHead title="Products" sub="What Beat sells. Prices, schemes and stock here are what the agent quotes on every call.">
        <button className="button primary" onClick={() => open()}><Plus /> Add product</button>
      </PageHead>
      <div className="toolbar">
        <Tabs value={filter} onChange={setFilter} options={[
          { value: "all", label: "All", count: n("all") },
          { value: "out", label: "Out of stock", count: n("out") },
          { value: "scheme", label: "Offers", count: n("scheme") },
          { value: "new", label: "New launches", count: n("new") },
        ]} />
        <div className="search-box"><Search /><input placeholder="Code or name" aria-label="Search products" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
      </div>

      {list.length === 0 ? (
        <Empty icon={<Package />} title={data.products.length ? "No products match" : "Your catalog is empty"}>
          <p>{data.products.length ? "Try another tab." : "Beat can only take orders for products listed here. Start with 25 common kirana lines and edit the prices."}</p>
          {!data.products.length && <div className="empty-actions"><button className="button primary" onClick={loadStarter}>Load starter catalog</button><button className="button secondary" onClick={() => open()}><Plus /> Add my own</button></div>}
        </Empty>
      ) : (
        <div className="panel">
          <div className="table-wrap">
            <table>
              <thead><tr><th>CODE</th><th>PRODUCT</th><th>PRICE</th><th>OFFER</th><th>IN STOCK</th><th /></tr></thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id} className={p.in_stock ? "" : "dim-row"}>
                    <td><code>{p.code}</code></td>
                    <td><b>{p.name}</b><span>{p.pack}</span>{p.is_new && <em className="new-tag">New launch</em>}</td>
                    <td><b>{inr(p.price)}</b><span>per {p.pack.split(" ")[0]}</span></td>
                    <td>{p.scheme_note ? <><b className="scheme-text">{p.scheme_note}</b>{p.scheme_off ? <span>{inr(p.scheme_off)} off from {p.scheme_min_qty}</span> : null}</> : <span>—</span>}</td>
                    <td>
                      <label className="switch-toggle">
                        <input type="checkbox" checked={p.in_stock} onChange={() => toggleStock(p)} aria-label={`${p.name} in stock`} />
                        <i />
                      </label>
                      {!p.in_stock && <span>{p.substitute ? `Offers ${p.substitute} instead` : "No substitute set"}</span>}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-button" aria-label={`Edit ${p.name}`} title="Edit" onClick={() => open(p)}><Pencil /></button>
                        <button className="icon-button danger" aria-label={`Remove ${p.name}`} title="Remove" onClick={() => remove(p)}><Trash2 /></button>
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
        <Modal title={editing.id === null ? "Add a product" : `Edit ${f.name || "product"}`} onClose={() => setEditing(null)} wide>
          <form className="form-grid three" onSubmit={save}>
            <Field label="Code" hint="Short, unique. The agent uses it, shops never hear it."><input required value={f.code} onChange={set("code")} placeholder="MG70" /></Field>
            <Field label="Name" hint="The way shopkeepers say it." span><input required value={f.name} onChange={set("name")} placeholder="Maggi Masala 70g" /></Field>
            <Field label="Pack"><input required value={f.pack} onChange={set("pack")} placeholder="case of 96" /></Field>
            <Field label="Price per pack (₹)"><input required inputMode="numeric" value={f.price} onChange={set("price")} placeholder="1250" /></Field>
            <Field label="Substitute code" hint="Offered when this is out of stock.">
              <select value={f.substitute} onChange={set("substitute")}>
                <option value="">None</option>
                {data.products.filter((p) => p.code !== f.code).map((p) => <option key={p.id} value={p.code}>{p.code} · {p.name}</option>)}
              </select>
            </Field>
            <Field label="Scheme from qty"><input inputMode="numeric" value={f.scheme_min_qty} onChange={set("scheme_min_qty")} placeholder="3" /></Field>
            <Field label="₹ off per pack"><input inputMode="numeric" value={f.scheme_off} onChange={set("scheme_off")} placeholder="40" /></Field>
            <Field label="Offer as Beat says it" hint="Leave empty for no offer."><input value={f.scheme_note} onChange={set("scheme_note")} placeholder="Rs 40 off per case on 3+ cases" /></Field>
            <label className="check span"><input type="checkbox" checked={f.in_stock} onChange={set("in_stock")} /> In stock</label>
            <label className="check span"><input type="checkbox" checked={f.is_new} onChange={set("is_new")} /> New launch (Beat mentions it once)</label>
            <div className="modal-actions span">
              <button type="button" className="button secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="button primary" disabled={busy}>{busy ? "Saving…" : editing.id === null ? "Add product" : "Save"}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

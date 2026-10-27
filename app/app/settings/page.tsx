"use client";

import { useEffect, useState } from "react";
import { Check, CircleAlert, LogOut } from "lucide-react";
import { useBeat } from "@/components/data";
import { Field, Loading, PageHead } from "@/components/ui";
import { LANGUAGES, OFFERED } from "@/lib/lang";

export default function Settings() {
  const { data, act, notify } = useBeat();
  const [form, setForm] = useState<{ name: string; owner_name: string; city: string; phone_number: string; delivery_note: string } | null>(null);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (data && !form) {
      const m = data.me;
      setForm({ name: m.name, owner_name: m.owner_name, city: m.city, phone_number: m.phone_number ?? "", delivery_note: m.delivery_note });
    }
  }, [data, form]);

  if (!data || !form) return <Loading />;
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save");
    const out = await act("/api/settings", "PATCH", form);
    setBusy("");
    if (out) notify("Settings saved. Beat uses them from the next call.");
  }

  async function load(what: "catalog" | "shops") {
    setBusy(what);
    const out = await act<{ added: number }>("/api/onboarding", "POST", { load: what });
    setBusy("");
    if (out) notify(out.added ? `Added ${out.added} ${what === "catalog" ? "products" : "shops"}.` : "Nothing new to add. You already have these.");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <>
      <PageHead title="Settings" sub="Your business profile, your Beat number and calling status." />
      <div className="settings-grid">
        <form className="panel pad" onSubmit={save}>
          <h2>Business profile</h2>
          <p className="muted">Beat introduces itself with your business name and tells shops when delivery comes.</p>
          <div className="form-grid">
            <Field label="Business name"><input required value={form.name} onChange={set("name")} /></Field>
            <Field label="Your name"><input required value={form.owner_name} onChange={set("owner_name")} /></Field>
            <Field label="City"><input value={form.city} onChange={set("city")} /></Field>
            <Field label="Beat number" hint="The Bolna number your shops ring. Calls to it are routed to this account.">
              <input inputMode="numeric" value={form.phone_number} onChange={set("phone_number")} placeholder="80 4567 8901" />
            </Field>
            <Field label="Delivery promise" hint="Beat reads this out after every order." span><input required value={form.delivery_note} onChange={set("delivery_note")} /></Field>
            <div className="modal-actions span"><button className="button primary" disabled={busy === "save"}>{busy === "save" ? "Saving…" : "Save changes"}</button></div>
          </div>
        </form>

        <div className="side-stack">
          <div className="panel pad">
            <h2>Calling</h2>
            {data.can_call
              ? <p className="ok-line"><Check /> Outbound calls are on. Start beat and Call now will ring shops.</p>
              : <p className="warn-line"><CircleAlert /> Outbound calls are off. Shops can still ring your Beat number. To call out, the Bolna API key and agent IDs must be set on the server.</p>}
            <div className="lang-list">
              {OFFERED.map((c) => {
                const on = data.can_call && (data.agent_languages.includes(c) || data.agent_languages.includes("kn"));
                return <span key={c} className={on ? "on" : ""}>{on ? <Check /> : null}{LANGUAGES[c]}</span>;
              })}
            </div>
            <small className="muted">Beat opens in Kannada and switches to English when the shopkeeper does.</small>
          </div>

          <div className="panel pad">
            <h2>Data</h2>
            <p className="muted">Fill an empty account quickly. Nothing you already have is changed.</p>
            <div className="empty-actions left">
              <button className="button secondary small" disabled={busy === "catalog"} onClick={() => load("catalog")}>Add starter catalog</button>
              <button className="button secondary small" disabled={busy === "shops"} onClick={() => load("shops")}>Add 5 sample shops</button>
            </div>
          </div>

          <div className="panel pad">
            <h2>Account</h2>
            <p className="muted">Signed in as <b>{data.me.email}</b></p>
            <button className="button secondary small" onClick={logout}><LogOut /> Log out</button>
          </div>
        </div>
      </div>
    </>
  );
}

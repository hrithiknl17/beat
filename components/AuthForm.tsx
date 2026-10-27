"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [form, setForm] = useState({ business_name: "", owner_name: "", email: "", password: "", city: "Bengaluru" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) { setError(out.error ?? "Something went wrong. Try again."); return; }
      window.location.href = "/app";
    } catch {
      setError("You seem to be offline. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const signup = mode === "signup";
  return (
    <div className="auth-page">
      <div className="auth-side">
        <Link href="/" className="auth-brand"><div className="brand-mark"><span>•••</span><span>•••</span></div><strong>Beat</strong></Link>
        <div>
          <h2>Your weekly beat, done by phone.</h2>
          <p>Beat calls every kirana shop on your route in their language, takes the order, applies your schemes and asks for overdue payments. You watch it arrive here.</p>
          <ul>
            <li>Speaks Kannada, switches to English when they do</li>
            <li>Orders priced against your own catalog</li>
            <li>Credit, promises and callbacks tracked for you</li>
          </ul>
        </div>
        <small>Built on Bolna voice AI</small>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <h1>{signup ? "Create your distributor account" : "Log in to Beat"}</h1>
        <p className="muted">{signup ? "Takes a minute. You can load a starter catalog right after." : "Welcome back."}</p>
        {signup && (
          <>
            <label className="field"><span>Business name</span><input required value={form.business_name} onChange={set("business_name")} placeholder="Sri Ganesh Distributors" autoComplete="organization" /></label>
            <div className="field-row">
              <label className="field"><span>Your name</span><input required value={form.owner_name} onChange={set("owner_name")} placeholder="Suresh Kumar" autoComplete="name" /></label>
              <label className="field"><span>City</span><input value={form.city} onChange={set("city")} autoComplete="address-level2" /></label>
            </div>
          </>
        )}
        <label className="field"><span>Email</span><input required type="email" value={form.email} onChange={set("email")} placeholder="you@business.in" autoComplete="email" /></label>
        <label className="field">
          <span>Password</span>
          <input required type="password" minLength={signup ? 8 : undefined} value={form.password} onChange={set("password")} autoComplete={signup ? "new-password" : "current-password"} />
          {signup && <small>At least 8 characters.</small>}
        </label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="button primary block" disabled={busy}>{busy ? "Please wait…" : signup ? "Create account" : "Log in"} <ArrowRight /></button>
        <p className="switch">
          {signup ? <>Already have an account? <Link href="/login">Log in</Link></> : <>New to Beat? <Link href="/signup">Create an account</Link></>}
        </p>
      </form>
    </div>
  );
}

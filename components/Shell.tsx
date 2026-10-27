"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity, FileText, Phone, Store, Package, WalletCards, Settings2, Menu, X, Moon, Sun, LogOut, CircleAlert,
} from "lucide-react";
import { BeatProvider, initials, LIVE, useBeat, type Me } from "./data";

const NAV = [
  { href: "/app", label: "Live beat", icon: Activity },
  { href: "/app/orders", label: "Orders", icon: FileText },
  { href: "/app/calls", label: "Calls", icon: Phone },
  { href: "/app/shops", label: "Shops", icon: Store },
  { href: "/app/products", label: "Products", icon: Package },
  { href: "/app/payments", label: "Payments", icon: WalletCards },
];

function greeting() {
  const h = Number(new Date().toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function Shell({ me, children }: { me: Me; children: React.ReactNode }) {
  return <BeatProvider><Frame me={me}>{children}</Frame></BeatProvider>;
}

function Frame({ me: initialMe, children }: { me: Me; children: React.ReactNode }) {
  const { data, error, notices, dismiss, act } = useBeat();
  const me = data?.me ?? initialMe;
  const path = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem("beat-theme"); } catch { /* storage blocked */ }
    setDark(saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);
  function toggleTheme() {
    setDark((d) => {
      try { localStorage.setItem("beat-theme", d ? "light" : "dark"); } catch { /* storage blocked */ }
      return !d;
    });
  }
  useEffect(() => setNavOpen(false), [path]);

  const live = data?.calls.filter((c) => LIVE.has(c.status) && !c.ended_at).length ?? 0;
  const counts: Record<string, number | undefined> = {
    "/app": live || undefined,
    "/app/orders": data?.stats.open_orders || undefined,
    "/app/shops": data?.shops.filter((s) => s.status === "new").length || undefined,
    "/app/payments": data?.callbacks.filter((c) => c.status === "pending").length || undefined,
  };
  const current = [...NAV, { href: "/app/settings", label: "Settings" }].find((n) => n.href === path)?.label ?? "Beat";

  async function logout() {
    await act("/api/auth/logout", "POST");
    window.location.href = "/login";
  }

  return (
    <div className={`beat-app ${dark ? "theme-dark" : ""}`}>
      {navOpen && <div className="nav-scrim" onClick={() => setNavOpen(false)} />}
      <aside className={`sidebar ${navOpen ? "sidebar-open" : ""}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><span>•••</span><span>•••</span></div>
          <div><strong>Beat</strong><small>{me.name}</small></div>
          <button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setNavOpen(false)}><X /></button>
        </div>
        <nav aria-label="Primary navigation">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={`nav-link ${path === href ? "active" : ""}`}>
              <Icon /> {label}
              {counts[href] !== undefined && <span className={`nav-count ${href === "/app" ? "" : "pale"}`}>{counts[href]}</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="beat-health">
            <span className={`health-dot ${data?.can_call ? "" : "off"}`} />
            <div>
              <b>{data?.can_call ? (live ? "Beat is on a call" : "Beat is ready") : "Calling not set up"}</b>
              <small>{data?.can_call
                ? `${data.stats.shops_called} of ${data.stats.active_shops} shops reached today`
                : "Inbound calls still work"}</small>
            </div>
          </div>
          <Link href="/app/settings" className={`nav-link ${path === "/app/settings" ? "active" : ""}`}><Settings2 /> Settings</Link>
          <div className="profile-row">
            <div className="profile-avatar">{initials(me.owner_name)}</div>
            <div><b>{me.owner_name}</b><small>{me.email}</small></div>
            <button className="icon-button dark" aria-label="Log out" title="Log out" onClick={logout}><LogOut /></button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setNavOpen(true)}><Menu /></button>
          <div className="breadcrumb"><span>{greeting()}, {me.owner_name.split(" ")[0]}</span><i>/</i><b>{current}</b></div>
          <div className="top-actions">
            <button className="theme-toggle" aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} onClick={toggleTheme}>{dark ? <Sun /> : <Moon />}</button>
            <Link href="/app/settings" className="top-avatar" aria-label="Settings">{initials(me.owner_name)}</Link>
          </div>
        </header>
        {error && <div className="banner"><CircleAlert /> {error}</div>}
        <div className="content-wrap">{children}</div>
      </main>

      <div className="toasts" aria-live="polite">
        {notices.map((n) => (
          <div key={n.id} className={`toast ${n.error ? "error" : ""}`} onClick={() => dismiss(n.id)}>{n.text}</div>
        ))}
      </div>
    </div>
  );
}

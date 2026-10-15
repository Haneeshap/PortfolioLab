"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import NotificationBell from "./NotificationBell";
import PortfolioChat from "./PortfolioChat";
import "./portfolio-shell.css";

type NavItem = { label: string; href: string; glyph: string; keywords?: string };
type NavGroup = { title: string; items: NavItem[]; collapsible?: boolean };
const groups: NavGroup[] = [
  { title: "Workspace", items: [
    { label: "Overview", href: "/", glyph: "▦", keywords: "dashboard home" },
    { label: "Markets", href: "/markets", glyph: "↗", keywords: "stocks prices trading" },
    { label: "Portfolio", href: "/portfolio", glyph: "◈", keywords: "holdings assets" },
  ] },
  { title: "Discover & monitor", items: [
    { label: "Market Intelligence", href: "/intelligence", glyph: "✦", keywords: "signals market feed movements trends" },
    { label: "Watchlists", href: "/watchlists", glyph: "☆", keywords: "favorites stocks" },
    { label: "Price Alerts", href: "/alerts", glyph: "◎", keywords: "threshold notification" },
  ] },
  { title: "Insights & tools", collapsible: true, items: [
    { label: "FX Analytics", href: "/fx", glyph: "⇄", keywords: "currency" },
    { label: "AI Agents", href: "/agents", glyph: "✧", keywords: "risk intelligence" },
    { label: "Activity", href: "/activity", glyph: "◷", keywords: "history transactions" },
    { label: "Notifications", href: "/notifications", glyph: "♧", keywords: "messages inbox" },
  ] },
];
const allItems = groups.flatMap((g) => g.items);

export default function AppShell({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<"dark" | "light" | "system">("system");
  useEffect(() => {
    const saved = window.localStorage.getItem("portfoliolab-theme");
    if (saved === "dark" || saved === "light" || saved === "system") setTheme(saved);
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => { document.documentElement.dataset.plTheme = theme === "system" ? (media.matches ? "dark" : "light") : theme; };
    apply();
    media.addEventListener("change", apply);
    window.localStorage.setItem("portfoliolab-theme", theme);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const current = allItems.find((item) => item.href === pathname) ?? allItems.find((item) => item.href !== "/" && pathname.startsWith(item.href + "/"));
  const filtered = useMemo(() => allItems.filter((item) => `${item.label} ${item.keywords ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())), [query]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearchOpen((v) => !v); }
      if (e.key === "Escape") { setSearchOpen(false); setMobileOpen(false); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { if (searchOpen) { setQuery(""); setSelected(0); const t = window.setTimeout(() => searchRef.current?.focus(), 30); return () => window.clearTimeout(t); } }, [searchOpen]);
  useEffect(() => { if (groups[2].items.some((item) => pathname === item.href)) setToolsOpen(true); }, [pathname]);
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  function navigate(href: string) { setSearchOpen(false); setMobileOpen(false); router.push(href); }

  return <div className="pl-shell">
    {mobileOpen && <button className="pl-mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <aside className={`pl-sidebar ${mobileOpen ? "pl-sidebar-open" : ""}`} aria-label="Main navigation">
      <Link href="/" className="pl-brand" onClick={() => setMobileOpen(false)}>
        <span className="pl-brand-mark">P<span className="pl-brand-spark">✦</span></span>
        <span className="pl-brand-copy"><strong>PortfolioLab</strong><small>MARKET SIMULATOR</small></span>
      </Link>
      <nav className="pl-nav">
        {groups.map((group) => <section key={group.title} className="pl-nav-group">
          {group.collapsible ? <button className="pl-nav-heading pl-nav-toggle" aria-expanded={toolsOpen} onClick={() => setToolsOpen((v) => !v)}>{group.title}<span>{toolsOpen ? "⌃" : "⌄"}</span></button> : <div className="pl-nav-heading">{group.title}</div>}
          {(!group.collapsible || toolsOpen) && <div className="pl-nav-links">{group.items.map((item) => <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} aria-current={pathname === item.href ? "page" : undefined} className={`pl-nav-link ${pathname === item.href ? "pl-nav-active" : ""}`}><span className="pl-nav-glyph" aria-hidden="true">{item.glyph}</span><span>{item.label}</span>{pathname === item.href && <span className="pl-nav-active-dot" />}</Link>)}</div>}
        </section>)}
      </nav>
      <div className="pl-sidebar-bottom"><span className="pl-live-dot" /><span><strong>SIMULATION ACTIVE</strong><small>Fictional assets · No real trading</small></span></div>
    </aside>
    <div className="pl-workspace">
      <header className="pl-header">
        <div className="pl-header-left"><button className="pl-mobile-menu" aria-label="Open navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen((v) => !v)}>☰</button><div className="pl-page-heading"><div className="pl-eyebrow">PORTFOLIOLAB <span>/</span> SIMULATOR</div><h1>{current?.label ?? "PortfolioLab"}</h1></div></div>
        <div className="pl-header-right"><button className="pl-header-search" onClick={() => setSearchOpen(true)} aria-label="Open command search"><span>⌕</span><span className="pl-header-search-label">Quick search</span><kbd>Ctrl K</kbd></button><div className="pl-theme-switch" role="group" aria-label="Color theme">
          {(["light", "dark", "system"] as const).map((mode) => <button key={mode} type="button" title={mode === "system" ? "Auto: follows your Windows/browser appearance" : `${mode[0].toUpperCase()}${mode.slice(1)} appearance`} aria-label={mode === "system" ? "Auto theme (follows system settings)" : `${mode} theme`} aria-pressed={theme === mode} className={theme === mode ? "pl-theme-active" : ""} onClick={() => setTheme(mode)}>{mode === "light" ? "☀" : mode === "dark" ? "☾" : "Auto"}</button>)}
        </div><span className="pl-header-divider" /><NotificationBell /><span className="pl-mode-pill"><span className="pl-live-dot" /> Simulation</span></div>
      </header>
      <main className="pl-main" id="main-content">{children}</main>
    </div>
    <PortfolioChat />
    {searchOpen && <div className="pl-command-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setSearchOpen(false); }}><div className="pl-command" role="dialog" aria-modal="true" aria-label="Search workspace"><div className="pl-command-input-row"><span>⌕</span><input ref={searchRef} value={query} onChange={(e) => { setQuery(e.target.value); setSelected(0); }} onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setSelected((n) => Math.min(n + 1, filtered.length - 1)); } else if (e.key === "ArrowUp") { e.preventDefault(); setSelected((n) => Math.max(n - 1, 0)); } else if (e.key === "Enter" && filtered[selected]) navigate(filtered[selected].href); }} placeholder="Search pages, tools, or workflows…" aria-label="Search pages" /><button onClick={() => setSearchOpen(false)}>ESC</button></div><div className="pl-command-results">{filtered.length ? filtered.map((item, index) => <button key={item.href} className={`pl-command-result ${index === selected ? "pl-command-selected" : ""}`} onMouseEnter={() => setSelected(index)} onClick={() => navigate(item.href)}><span className="pl-command-glyph">{item.glyph}</span><span>{item.label}</span><span className="pl-command-arrow">↗</span></button>) : <p className="pl-command-empty">No matching pages. Try “Markets”, “Alerts”, or “Portfolio”.</p>}</div><div className="pl-command-footer">↑ ↓ Navigate <span>↵ Open</span> <span>ESC Close</span></div></div></div>}
  </div>;
}

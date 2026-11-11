"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Menu,
  X,
  Search,
  ChartNoAxesColumnIncreasing,
  Layers,
  Database,
  ChevronDown,
  ArrowUpRight,
  Github,
} from "lucide-react";
import { Brand } from "./brand";
export function Shell({
  mode,
  children,
  query,
  onQuery,
  category,
  onCategory,
}: {
  mode: "markets" | "docs";
  children: React.ReactNode;
  query: string;
  onQuery: (q: string) => void;
  category?: string;
  onCategory?: (c: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const aside = useRef<HTMLElement>(null);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        search.current?.focus();
      }
      if (e.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    }
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (!open) return;
    const prior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    aside.current?.querySelector<HTMLElement>("a,button")?.focus();
    function trap(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const items = aside.current?.querySelectorAll<HTMLElement>("a,button");
      if (!items?.length) return;
      const first = items[0],
        last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", trap);
    return () => {
      document.body.style.overflow = prior;
      document.removeEventListener("keydown", trap);
    };
  }, [open]);
  const docs = mode === "docs";
  return (
    <div
      className={`app-shell ${docs ? "docs-shell" : ""} ${collapsed ? "sidebar-collapsed" : ""}`}
    >
      {open && (
        <button
          className="drawer-backdrop"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        ref={aside}
        className={`sidebar ${open ? "drawer-open" : ""}`}
        aria-label={docs ? "Documentation navigation" : "Market navigation"}
      >
        <Brand build={docs} />
        <button
          className="drawer-close icon-button"
          aria-label="Close navigation"
          onClick={() => {
            setOpen(false);
            toggle.current?.focus();
          }}
        >
          <X />
        </button>
        {docs ? (
          <nav
            className="docs-navigation"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) setOpen(false);
            }}
          >
            <a className="selected" href="#overview">
              Introduction
            </a>
            <a href="#start-with-the-sdk">Quickstart</a>
            <details open>
              <summary>
                Integration
                <ChevronDown size={20} />
              </summary>
              <a href="#read-a-price">Read a Price</a>
              <a href="#build-a-witness">Build a Witness</a>
              <a href="#header-dependencies">Attach Header Dependencies</a>
            </details>
            <details open>
              <summary>
                Reference
                <ChevronDown size={20} />
              </summary>
              <a href="#feed-identifiers">Feed Identifiers</a>
              <a href="#payload-structure">Payload Structure</a>
              <a href="#sdk-methods">SDK Methods</a>
              <a href="#verifier-errors">Verifier Errors</a>
            </details>
          </nav>
        ) : (
          <nav className="market-navigation">
            <p>Market Data</p>
            {[
              ["All Markets", ChartNoAxesColumnIncreasing],
              ["Crypto Assets", Layers],
              ["Stablecoins", Database],
            ].map(([label, Icon]) => {
              const I = Icon as typeof Layers;
              return (
                <button
                  key={label as string}
                  className={category === label ? "selected" : ""}
                  onClick={() => {
                    onCategory?.(label as string);
                    setOpen(false);
                  }}
                >
                  <I size={27} />
                  {label as string}
                </button>
              );
            })}
          </nav>
        )}
        <div className="sidebar-bottom">
          <Link href={docs ? "/markets" : "/docs"}>
            {docs && <ChartNoAxesColumnIncreasing size={22} />}{" "}
            {docs ? "Market Data" : "Build"} <ArrowUpRight size={18} />
          </Link>
          <a
            className="github-link"
            href="https://github.com/rikokurnia/oracell"
          >
            {docs && <Github size={22} />}GitHub <ArrowUpRight size={18} />
          </a>
          {!docs && <p>Oracell / CKB</p>}
        </div>
      </aside>
      <div className="workspace">
        <header className="toolbar">
          <button
            ref={toggle}
            className="icon-button menu-toggle"
            aria-label="Toggle sidebar"
            aria-expanded={open || !collapsed}
            onClick={() => {
              if (window.innerWidth <= 900) setOpen(!open);
              else setCollapsed(!collapsed);
            }}
          >
            <Menu />
          </button>
          {docs ? (
            <nav className="docs-tabs" aria-label="Documentation sections">
              <a className="active" href="#overview">
                Guides
              </a>
              <a href="#sdk-methods">SDK Reference</a>
              <a href="#changelog">Changelog</a>
            </nav>
          ) : (
            <div className="breadcrumb">
              <span>Market Data</span>
              <span>/</span>
              <strong>{category}</strong>
            </div>
          )}
          <label className="search">
            <Search size={24} />
            <input
              ref={search}
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder={
                docs ? "Search documentation..." : "Search markets..."
              }
              aria-label={docs ? "Search documentation" : "Search markets"}
            />
            <kbd>⌘ K</kbd>
          </label>
        </header>
        {children}
      </div>
    </div>
  );
}

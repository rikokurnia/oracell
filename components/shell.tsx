"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  X,
  Search,
  ChartNoAxesColumnIncreasing,
  Layers,
  ChevronDown,
  ArrowUpRight,
  Github,
  BookOpen,
  Code2,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Brand } from "./brand";

const mobileQuery = "(max-width: 767px)";
function subscribeViewport(callback: () => void) {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
const getMobileSnapshot = () => window.matchMedia(mobileQuery).matches;
const getServerSnapshot = () => false;
const categories = [
  { label: "All Markets", Icon: ChartNoAxesColumnIncreasing },
  { label: "Crypto Assets", Icon: Layers },
];

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
  const docs = mode === "docs";
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(!docs);
  const isMobile = useSyncExternalStore(
    subscribeViewport,
    getMobileSnapshot,
    getServerSnapshot,
  );
  const search = useRef<HTMLInputElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const aside = useRef<HTMLElement>(null);
  const expanded = isMobile ? open : !collapsed;

  function closeDrawer() {
    setOpen(false);
    if (isMobile) toggle.current?.focus();
  }

  useEffect(() => {
    function key(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        search.current?.focus();
      }
      if (e.key === "Escape") {
        setOpen(false);
        onQuery("");
        if (open) toggle.current?.focus();
      }
    }
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onQuery, open]);

  useEffect(() => {
    if (!open || !isMobile) return;
    const prior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    aside.current?.querySelector<HTMLElement>("a,button")?.focus();
    function trap(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const items = Array.from(
        aside.current?.querySelectorAll<HTMLElement>("a,button,summary") ?? [],
      ).filter((item) => item.getClientRects().length > 0);
      if (!items.length) return;
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
  }, [open, isMobile]);

  return (
    <div
      className={`app-shell ${docs ? "docs-shell" : ""} ${collapsed ? "sidebar-collapsed" : ""}`}
    >
      {open && isMobile && (
        <button
          className="drawer-backdrop"
          aria-label="Close navigation"
          onClick={closeDrawer}
        />
      )}
      <aside
        ref={aside}
        id="app-navigation"
        className={`sidebar ${open && isMobile ? "drawer-open" : ""}`}
        aria-label={docs ? "Documentation navigation" : "Market navigation"}
      >
        <Brand build={docs} />
        <button
          className="drawer-close icon-button"
          aria-label="Close navigation"
          onClick={closeDrawer}
        >
          <X size={18} />
        </button>
        {docs ? (
          <>
            <nav
              className="docs-rail-navigation"
              aria-label="Documentation shortcuts"
            >
              <a
                href="#overview"
                aria-label="Introduction"
                data-tooltip="Introduction"
              >
                <BookOpen size={19} />
              </a>
              <a
                href="#start-with-the-sdk"
                aria-label="Quickstart"
                data-tooltip="Quickstart"
              >
                <Code2 size={19} />
              </a>
              <a
                href="#sdk-methods"
                aria-label="SDK Reference"
                data-tooltip="SDK Reference"
              >
                <FileText size={19} />
              </a>
            </nav>
            <nav
              className="docs-navigation"
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("a")) closeDrawer();
              }}
            >
              <a className="selected" href="#overview">
                Introduction
              </a>
              <a href="#start-with-the-sdk">Quickstart</a>
              <details open>
                <summary>
                  Integration
                  <ChevronDown size={15} />
                </summary>
                <a href="#read-a-price">Read a Price</a>
                <a href="#build-a-witness">Build a Witness</a>
                <a href="#header-dependencies">Attach Header Dependencies</a>
              </details>
              <details open>
                <summary>
                  Reference
                  <ChevronDown size={15} />
                </summary>
                <a href="#feed-identifiers">Feed Identifiers</a>
                <a href="#payload-structure">Payload Structure</a>
                <a href="#sdk-methods">SDK Methods</a>
                <a href="#verifier-errors">Verifier Errors</a>
              </details>
            </nav>
          </>
        ) : (
          <nav className="market-navigation" aria-label="Market categories">
            <p>Market Data</p>
            {categories.map(({ label, Icon }) => (
              <button
                key={label}
                aria-label={label}
                aria-pressed={category === label}
                data-tooltip={label}
                className={category === label ? "selected" : ""}
                onClick={() => {
                  onCategory?.(label);
                  closeDrawer();
                }}
              >
                <Icon size={19} />
                <span className="nav-label">{label}</span>
              </button>
            ))}
          </nav>
        )}
        <div className="sidebar-bottom">
          <Link
            href={docs ? "/markets" : "/docs"}
            aria-label={docs ? "Market Data" : "Build"}
            data-tooltip={docs ? "Market Data" : "Build"}
          >
            {docs ? (
              <ChartNoAxesColumnIncreasing size={19} />
            ) : (
              <BookOpen size={19} />
            )}
            <span className="nav-label">{docs ? "Market Data" : "Build"}</span>
            <ArrowUpRight className="external-arrow" size={13} />
          </Link>
          <a
            href="https://github.com/rikokurnia/oracell"
            aria-label="GitHub"
            data-tooltip="GitHub"
          >
            <Github size={19} />
            <span className="nav-label">GitHub</span>
            <ArrowUpRight className="external-arrow" size={13} />
          </a>
          {!docs && <p>Oracell / CKB</p>}
        </div>
      </aside>
      <div className="workspace">
        <header className="toolbar">
          <button
            ref={toggle}
            className="icon-button menu-toggle"
            aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
            aria-controls="app-navigation"
            aria-expanded={expanded}
            onClick={() => {
              if (isMobile) setOpen(!open);
              else setCollapsed(!collapsed);
            }}
          >
            {expanded ? (
              <PanelLeftClose size={18} />
            ) : (
              <PanelLeftOpen size={18} />
            )}
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
            <Search size={16} />
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

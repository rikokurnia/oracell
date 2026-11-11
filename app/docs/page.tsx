"use client";
import { useState } from "react";
import Link from "next/link";
import { Copy, Check, Code, ArrowRight } from "lucide-react";
import { Shell } from "@/components/shell";
import { docsSections, sdkCode, pageText } from "@/lib/docs";
function CopyButton({
  text,
  label,
  iconOnly = false,
}: {
  text: string;
  label: string;
  iconOnly?: boolean;
}) {
  const [status, setStatus] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Copied");
      setTimeout(() => setStatus(""), 1800);
    } catch {
      setStatus("Copy unavailable");
    }
  }
  return (
    <button className="copy-button" onClick={copy} aria-label={status || label}>
      {status === "Copied" ? <Check size={21} /> : <Copy size={21} />}
      {!iconOnly && (status || label)}
      <span className="sr-only" role="status">
        {status}
      </span>
    </button>
  );
}
export default function Docs() {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState(false);
  const [active, setActive] = useState("overview");
  const results = [
    { id: "overview", title: "Introduction", body: "Build with Oracell" },
    { id: "start-with-the-sdk", title: "Start with the SDK", body: sdkCode },
    ...docsSections,
  ].filter((s) =>
    `${s.title} ${s.body}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <Shell mode="docs" query={query} onQuery={setQuery}>
      <main id="main" className="docs-main">
        <article className="docs-article">
          <div className="doc-breadcrumb">Guides / Introduction</div>
          <section id="overview">
            <h1>Build with Oracell.</h1>
            <p className="doc-subtitle">
              Integrate signed market data into your CKB application.
            </p>
            <div className="article-actions">
              <CopyButton text={pageText} label="Copy page" />
              <span />
              <button onClick={() => setSource(!source)} aria-expanded={source}>
                <Code size={23} />
                {source ? "Hide source" : "View source"}
              </button>
            </div>
            {source && (
              <pre className="page-source">
                <code>{pageText}</code>
              </pre>
            )}
            <p className="doc-intro">
              Oracell delivers signed price payloads that applications can
              include in transaction witnesses. Use the TypeScript SDK to
              retrieve a price, prepare its witness, and attach the referenced
              CKB header.
            </p>
            <div className="doc-cards">
              <a href="#start-with-the-sdk">
                <strong>
                  Get your first price <ArrowRight />
                </strong>
                <span>Retrieve a signed payload with the TypeScript SDK.</span>
              </a>
              <a href="#verification-flow">
                <strong>
                  Understand verification <ArrowRight />
                </strong>
                <span>Explore payload signatures and header dependencies.</span>
              </a>
            </div>
          </section>
          <section id="start-with-the-sdk">
            <h2>Start with the SDK</h2>
            <div className="code-block">
              <div className="code-header">
                <span>TypeScript</span>
                <CopyButton
                  text={sdkCode}
                  label="Copy TypeScript code"
                  iconOnly
                />
              </div>
              <pre>
                <code>
                  <span className="syntax-key">import</span>
                  {" { OracellClient } "}
                  <span className="syntax-key">from</span>{" "}
                  <span className="syntax-string">
                    &apos;@oracell/sdk&apos;
                  </span>
                  {";\n\n"}
                  <span className="syntax-key">const</span>
                  {" client = "}
                  <span className="syntax-key">new</span>
                  {" OracellClient();\n"}
                  <span className="syntax-key">const</span>
                  {" price = "}
                  <span className="syntax-key">await</span>
                  {" client.getLatestPrice("}
                  <span className="syntax-string">&apos;CKB/USD&apos;</span>
                  {");\n\nconsole.log(price);"}
                </code>
              </pre>
            </div>
          </section>
          {docsSections.map((s) => (
            <section className="doc-section" key={s.id} id={s.id}>
              <h2>{s.title}</h2>
              <p>{s.body}</p>
              {s.id === "next-steps" && (
                <Link className="text-link" href="/markets">
                  Explore Market Data ↗
                </Link>
              )}
            </section>
          ))}
        </article>
        <nav className="contents" aria-label="On this page">
          <p>On this page</p>
          {[
            ["overview", "Overview"],
            ["start-with-the-sdk", "Start with the SDK"],
            ["verification-flow", "Verification flow"],
            ["next-steps", "Next steps"],
          ].map(([id, label]) => (
            <a
              className={active === id ? "active" : ""}
              key={id}
              href={`#${id}`}
              onClick={() => setActive(id)}
            >
              {label}
            </a>
          ))}
        </nav>
      </main>
      {query && (
        <div
          className="search-results"
          role="region"
          aria-label="Documentation search results"
        >
          <div className="search-results-heading">
            {results.length} results
            <button onClick={() => setQuery("")}>Close</button>
          </div>
          {results.length ? (
            results.map((s) => (
              <a href={`#${s.id}`} onClick={() => setQuery("")} key={s.id}>
                {s.title}
                <ArrowRight size={18} />
              </a>
            ))
          ) : (
            <p>No sections found. Try “price” or “witness”.</p>
          )}
        </div>
      )}
    </Shell>
  );
}

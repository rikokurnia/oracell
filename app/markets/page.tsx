"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Shell } from "@/components/shell";
import { markets, Market } from "@/lib/markets";
export default function Markets() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All Markets");
  const [crypto, setCrypto] = useState(true);
  const [stable, setStable] = useState(true);
  const [usd, setUsd] = useState(true);
  const [sort, setSort] = useState<"name" | "price" | "change" | null>(null);
  const [asc, setAsc] = useState(true);
  const rows = markets
    .filter(
      (m) =>
        usd &&
        (m.type === "Crypto" ? crypto : stable) &&
        (category === "All Markets" ||
          (category === "Crypto Assets"
            ? m.type === "Crypto"
            : m.type === "Stablecoin")) &&
        `${m.name} ${m.symbol} ${m.feed}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      !sort
        ? 0
        : (asc ? 1 : -1) *
          (sort === "name" ? a.name.localeCompare(b.name) : a[sort] - b[sort]),
    );
  function order(key: typeof sort) {
    setAsc(sort === key ? !asc : true);
    setSort(key);
  }
  function reset() {
    setQuery("");
    setCategory("All Markets");
    setCrypto(true);
    setStable(true);
    setUsd(true);
  }
  return (
    <Shell
      mode="markets"
      query={query}
      onQuery={setQuery}
      category={category}
      onCategory={setCategory}
    >
      <main id="main" className="markets-main">
        <section className="market-banner">
          <div>
            <h1>Market prices. Verifiable by design.</h1>
            <p>Discover signed price feeds for applications built on CKB.</p>
            <Link href="/docs">Read the integration guide ↗</Link>
          </div>
          <Image
            src="/oracell-market-data-banner.png"
            alt=""
            width={1536}
            height={1024}
            priority
          />
        </section>
        <div className="market-heading">
          <h2>{category}</h2>
          <span aria-live="polite">
            {rows.length} {rows.length === 1 ? "market" : "markets"}
          </span>
        </div>
        <div className="market-grid">
          <aside className="filters" aria-label="Market filters">
            <h3>Filters</h3>
            <fieldset>
              <legend>Asset type</legend>
              <label>
                <input
                  type="checkbox"
                  checked={crypto}
                  onChange={(e) => setCrypto(e.target.checked)}
                />
                Crypto
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={stable}
                  onChange={(e) => setStable(e.target.checked)}
                />
                Stablecoin
              </label>
            </fieldset>
            <fieldset>
              <legend>Quote currency</legend>
              <label>
                <input
                  type="checkbox"
                  checked={usd}
                  onChange={(e) => setUsd(e.target.checked)}
                />
                USD
              </label>
            </fieldset>
          </aside>
          <div className="table-area">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    {[
                      ["Market", "name"],
                      ["Price", "price"],
                      ["24h Change", "change"],
                    ].map(([label, key]) => (
                      <th
                        key={key}
                        aria-sort={
                          sort === key
                            ? asc
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                      >
                        <button onClick={() => order(key as typeof sort)}>
                          {label}
                          {sort === key ? (
                            asc ? (
                              <ArrowUp size={15} />
                            ) : (
                              <ArrowDown size={15} />
                            )
                          ) : null}
                        </button>
                      </th>
                    ))}
                    <th>7D Trend</th>
                    <th>Updated</th>
                    <th>Feed ID</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((m) => (
                    <tr key={m.symbol}>
                      <td>
                        <div className="market-name">
                          <Image
                            className="asset-logo"
                            src={m.logo}
                            alt={`${m.name} logo`}
                            width={56}
                            height={56}
                          />
                          <div>
                            <strong>{m.name}</strong>
                            <span>{m.symbol}</span>
                          </div>
                        </div>
                      </td>
                      <td>${m.displayPrice}</td>
                      <td
                        className={
                          m.change < 0
                            ? "negative"
                            : m.type === "Stablecoin"
                              ? "muted"
                              : "positive"
                        }
                      >
                        {m.change < 0 ? "−" : "+"}
                        {Math.abs(m.change).toFixed(2)}%
                      </td>
                      <td>
                        <Sparkline market={m} />
                      </td>
                      <td className="muted">—</td>
                      <td>
                        <code>{m.feed}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && (
                <div className="empty-state">
                  <h3>No markets found</h3>
                  <p>Try another search or adjust your filters.</p>
                  <button onClick={reset}>Clear search and filters</button>
                </div>
              )}
            </div>
            <p className="table-note">Prices in USD</p>
          </div>
        </div>
      </main>
    </Shell>
  );
}
function Sparkline({ market }: { market: Market }) {
  return (
    <svg
      className={`sparkline ${market.change < 0 ? "negative" : market.type === "Stablecoin" ? "muted" : "positive"}`}
      viewBox="0 0 150 42"
      role="img"
      aria-label={`${market.symbol} seven-day price trend`}
    >
      <polyline
        points={market.trend.map((y, i) => `${i * 7},${y}`).join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

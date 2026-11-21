"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Shell } from "@/components/shell";
import { useMarketFeeds } from "@/hooks/use-market-feeds";
import {
  getMarkets,
  formatPrice,
  feedAge,
  STALE_AFTER_MS,
  type Market,
} from "@/lib/markets";

type SortKey = "name" | "price" | "updated";
function sortValue(m: Market, key: Exclude<SortKey, "name">) {
  if (!m.feed) return null;
  return key === "price"
    ? BigInt(m.feed.payload.priceScaled)
    : BigInt(m.feed.payload.timestampMs);
}
export default function Markets() {
  const { feeds, status, now } = useMarketFeeds();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All Markets");
  const [crypto, setCrypto] = useState(true);
  const [usdt, setUsdt] = useState(true);
  const [sort, setSort] = useState<SortKey | null>(null);
  const [asc, setAsc] = useState(true);
  const rows = getMarkets(feeds)
    .filter(
      (m) =>
        usdt &&
        crypto &&
        `${m.name} ${m.symbol} ${m.pairKey}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) => {
      if (!sort) return 0;
      if (sort === "name") return (asc ? 1 : -1) * a.name.localeCompare(b.name);
      const x = sortValue(a, sort),
        y = sortValue(b, sort);
      if (x === null) return y === null ? 0 : 1;
      if (y === null) return -1;
      return (asc ? 1 : -1) * (x < y ? -1 : x > y ? 1 : 0);
    });
  function order(key: SortKey) {
    setAsc(sort === key ? !asc : true);
    setSort(key);
  }
  function reset() {
    setQuery("");
    setCategory("All Markets");
    setCrypto(true);
    setUsdt(true);
  }
  const outdated = feeds.some(
    (f) => now - f.payload.timestampMs > STALE_AFTER_MS,
  );
  const notice =
    status === "connecting"
      ? "Connecting to price feeds…"
      : status === "offline"
        ? feeds.length
          ? "Connection unavailable · Showing last received prices."
          : "Price feeds unavailable · Reconnecting automatically."
        : !feeds.length
          ? "Connected · Waiting for signed price feeds."
          : outdated
            ? "Connected · Some feeds have not updated recently."
            : "Connected · Checking for updated prices.";
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
            </fieldset>
            <fieldset>
              <legend>Quote currency</legend>
              <label>
                <input
                  type="checkbox"
                  checked={usdt}
                  onChange={(e) => setUsdt(e.target.checked)}
                />
                USDT
              </label>
            </fieldset>
          </aside>
          <div className="table-area">
            <div
              className="table-scroll"
              role="region"
              aria-label="Market prices, scroll horizontally for more columns"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    {(
                      [
                        ["Market", "name"],
                        ["Price", "price"],
                      ] as const
                    ).map(([label, key]) => (
                      <SortHeader
                        key={key}
                        label={label}
                        sortKey={key}
                        sort={sort}
                        asc={asc}
                        order={order}
                      />
                    ))}
                    <th>Sources</th>
                    <th>CKB anchor</th>
                    <SortHeader
                      label="Updated"
                      sortKey="updated"
                      sort={sort}
                      asc={asc}
                      order={order}
                    />
                    <th>Pair key</th>
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
                            width={30}
                            height={30}
                          />
                          <div>
                            <strong>{m.name}</strong>
                            <span>{m.symbol}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        {m.feed ? (
                          formatPrice(m.feed.payload.priceScaled)
                        ) : (
                          <span
                            className="muted"
                            aria-label="Price unavailable"
                          >
                            —
                          </span>
                        )}
                      </td>
                      <td>
                        {m.feed ? (
                          <span
                            title={
                              m.feed.payload.flags & 1
                                ? "Includes a fallback source"
                                : "Contributing price sources"
                            }
                          >
                            {m.feed.payload.sourceCount}
                            {m.feed.payload.flags & 2 ? " · Paused" : ""}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {m.feed ? (
                          <span title={m.feed.payload.tipBlockHash}>
                            {m.feed.payload.blockNumber.toLocaleString("en-US")}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="muted">
                        {m.feed ? (
                          <time
                            title={new Date(
                              m.feed.payload.timestampMs,
                            ).toISOString()}
                            dateTime={new Date(
                              m.feed.payload.timestampMs,
                            ).toISOString()}
                          >
                            {feedAge(m.feed.payload.timestampMs, now)}
                          </time>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <code>{m.pairKey}</code>
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
            <div className="feed-status">
              <p className="table-note" role="status">
                {notice}
              </p>
              <span className="table-note">Prices in USDT</span>
            </div>
          </div>
        </div>
      </main>
    </Shell>
  );
}
function SortHeader({
  label,
  sortKey,
  sort,
  asc,
  order,
}: {
  label: string;
  sortKey: SortKey;
  sort: SortKey | null;
  asc: boolean;
  order: (key: SortKey) => void;
}) {
  return (
    <th
      aria-sort={sort === sortKey ? (asc ? "ascending" : "descending") : "none"}
    >
      <button onClick={() => order(sortKey)}>
        {label}
        {sort === sortKey &&
          (asc ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}
      </button>
    </th>
  );
}

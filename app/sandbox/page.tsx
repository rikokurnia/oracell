"use client";

import Link from "next/link";
import { useState } from "react";
import benchmark from "@/contracts/benchmark.json";
import { marketCatalog } from "@/lib/markets";
import { PHASE_ONE_PUBLISHER_PUBKEY } from "@/lib/publisher";

export default function Sandbox() {
  const [selected, setSelected] = useState<"baseline" | "oracell">("oracell");
  const [pair, setPair] = useState("CKB/USDT");
  const [ran, setRan] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const measurement = benchmark[selected];

  async function runSdk() {
    setLoading(true);
    setError("");
    setResult("");
    try {
      const response = await fetch(
        `/api/oracle/playground?pair=${encodeURIComponent(pair)}`,
        {
          cache: "no-store",
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Playground request failed");
      setResult(JSON.stringify(data, null, 2));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Playground request failed",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="docs-main sandbox-main" id="main">
      <article className="docs-article">
        <Link className="text-link" href="/docs">
          ← Build docs
        </Link>
        <h1>Oracle security sandbox</h1>
        <p className="doc-subtitle">
          Compare cell contention and construct a live oracle witness with the
          SDK.
        </p>
        <section className="doc-section" id="contention">
          <h2>Transaction contention</h2>
          <p>
            Replay measurements from the CKB-VM emulator. The shared-cell
            scenario submits 20 transactions for one consumable outpoint. The
            witness scenario verifies 100 transactions with distinct inputs.
          </p>
          <div className="sandbox-controls">
            <button
              aria-pressed={selected === "baseline"}
              onClick={() => setSelected("baseline")}
            >
              20 · Shared cell
            </button>
            <button
              aria-pressed={selected === "oracell"}
              onClick={() => setSelected("oracell")}
            >
              100 · Oracell witnesses
            </button>
            <button onClick={() => setRan(true)}>Show measured results</button>
          </div>
          {ran && (
            <div className="sandbox-measurement" role="status">
              <strong>
                {measurement.verified} / {measurement.submitted} verified
              </strong>
              <meter
                min={0}
                max={measurement.submitted}
                value={measurement.verified}
                aria-label="Verified transactions"
              />
              <p>{measurement.conflicts} shared input conflicts</p>
              <p>
                {"minCycles" in measurement
                  ? `${measurement.minCycles.toLocaleString("en-US")}–${measurement.maxCycles.toLocaleString("en-US")} cycles per verified witness transaction`
                  : `${measurement.cycles.toLocaleString("en-US")} cycles for the admitted baseline transaction`}
              </p>
            </div>
          )}
          <p>
            The baseline applies the UTXO spend rule before script execution and
            uses a minimal fixture script. Counts are emulator results, and do
            not measure block throughput or a production oracle implementation.
          </p>
        </section>
        <section className="doc-section" id="sdk-playground">
          <h2>SDK playground</h2>
          <p>
            Choose a pair and run the example. The server calls the published
            API with the actual SDK and returns witness bytes and timings. The
            example verifies the signature against the pinned Phase 1 publisher
            key.
          </p>
          <div className="sandbox-controls">
            <label>
              Market{" "}
              <select
                value={pair}
                onChange={(event) => {
                  setPair(event.target.value);
                  setResult("");
                  setError("");
                }}
                disabled={loading}
              >
                {marketCatalog.map((market) => (
                  <option key={market.symbol}>{market.symbol}</option>
                ))}
              </select>
            </label>
            <button disabled={loading} onClick={runSdk}>
              {loading ? "Running SDK…" : "Run SDK example"}
            </button>
          </div>
          <div className="code-block">
            <pre>
              <code>{`import { OracellClient, injectOracleProof } from '@oracell/sdk';

const client = new OracellClient();
const quote = await client.getLatestPrice('${pair}');
const publisher = '${PHASE_ONE_PUBLISHER_PUBKEY}';
if (!client.verifyFeed(quote, publisher)) throw new Error('Invalid signature');

const tx = injectOracleProof({ witnesses: ['0x'], headerDeps: [] }, quote);`}</code>
            </pre>
          </div>
          <div aria-live="polite">
            {error && (
              <p className="sandbox-feedback" role="alert">
                {error}
              </p>
            )}
            {result && (
              <div className="code-block sandbox-feedback">
                <pre>
                  <code>{result}</code>
                </pre>
              </div>
            )}
          </div>
        </section>
      </article>
    </main>
  );
}

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseFeedsResponse,
  formatPrice,
  getMarkets,
  canConnectToAggregator,
  FEEDS_ENDPOINT,
  feedAge,
} from "../lib/markets.ts";
const hex = (bytes) => `0x${"ab".repeat(bytes)}`;
const feed = {
  pair: "CKB/USDT",
  pairKey: "CKB_USDT",
  payload: {
    magic: "ORCL",
    version: 1,
    pair: "CKB/USDT",
    priceScaled: "89900",
    decimals: 8,
    price: 0.000899,
    timestampMs: 1794966400000,
    blockNumber: 23099353,
    tipBlockHash: hex(32),
    blockTimestampMs: 1794966398000,
    sourceCount: 2,
    flags: 1,
  },
  payloadHex: hex(88),
  digestHex: hex(32),
  pubkey: hex(32),
  signature: hex(64),
  witnessHex: hex(184),
};
const envelope = (feeds) => ({ version: 1, publisherPubkey: hex(32), feeds });
test("accepts the signed feed schema and maps supported USDT pairs", () => {
  const rows = getMarkets(parseFeedsResponse(envelope([feed])));
  assert.equal(rows.length, 4);
  assert.equal(rows[0].feed.payload.priceScaled, "89900");
  assert.equal(rows[3].symbol, "SOL/USDT");
  assert.equal(rows[3].feed, null);
});
test("empty/offline catalog has no manufactured prices", () => {
  assert.ok(getMarkets([]).every((m) => m.feed === null));
  assert.deepEqual(parseFeedsResponse(envelope([])), []);
});
test("rejects malformed envelopes, proofs, duplicate pairs, and publisher mismatches", () => {
  assert.throws(() => parseFeedsResponse({ feeds: [] }));
  for (const bad of [
    { ...feed, signature: "0x00" },
    { ...feed, pubkey: `0x${"cd".repeat(32)}` },
    { ...feed, payload: { ...feed.payload, decimals: 6 } },
    {
      ...feed,
      payload: { ...feed.payload, priceScaled: "18446744073709551616" },
    },
    {
      ...feed,
      payload: { ...feed.payload, timestampMs: 9_000_000_000_000_000 },
    },
  ])
    assert.throws(() => parseFeedsResponse(envelope([bad])));
  assert.throws(() => parseFeedsResponse(envelope([feed, feed])));
});
test("formats scaled integer prices without losing decimal precision", () => {
  assert.equal(formatPrice("89900"), "0.000899");
  assert.equal(formatPrice("10428650000000"), "104,286.50");
  assert.equal(formatPrice("18446744073709551615"), "184,467,440,737.09551615");
  assert.equal(formatPrice("1"), "0.00000001");
});
test("uses the same-origin hosted endpoint by default", () => {
  assert.equal(FEEDS_ENDPOINT, "/api/oracle/feeds");
  assert.equal(canConnectToAggregator({ hostname: "oracell.vercel.app", protocol: "https:" }), true);
});
test("feed timestamps show actual age, including stale snapshots", () => {
  assert.equal(feedAge(1000, 6000), "5s ago");
  assert.equal(feedAge(1000, 181000), "3m ago");
  assert.equal(feedAge(6000, 1000), "0s ago");
});

test("configured HTTPS aggregator is usable from a hosted origin", async () => {
  const previous = process.env.NEXT_PUBLIC_ORACELL_AGGREGATOR_URL;
  try {
    process.env.NEXT_PUBLIC_ORACELL_AGGREGATOR_URL =
      "https://feeds.example.org/api/";
    const configured = await import("../lib/markets.ts?configured");
    assert.equal(configured.AGGREGATOR_URL, "https://feeds.example.org/api");
    assert.equal(configured.FEEDS_ENDPOINT, "https://feeds.example.org/api/v1/oracle/feeds");
    assert.equal(
      configured.canConnectToAggregator({
        hostname: "oracell.vercel.app",
        protocol: "https:",
      }),
      true,
    );
  } finally {
    if (previous === undefined)
      delete process.env.NEXT_PUBLIC_ORACELL_AGGREGATOR_URL;
    else process.env.NEXT_PUBLIC_ORACELL_AGGREGATOR_URL = previous;
  }
});

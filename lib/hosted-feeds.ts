import { OracleAggregator } from "../services/aggregator/dist/aggregator";
import { CkbTipSynchronizer } from "../services/aggregator/dist/ckbSync";
import { BinanceFeed } from "../services/aggregator/dist/sources/binance";
import { OkxFeed } from "../services/aggregator/dist/sources/okx";
import type { PairSymbol, PriceSourceQuote } from "../services/aggregator/dist/types";

const coinIds: Record<PairSymbol, string> = {
  "CKB/USDT": "nervos-network",
  "BTC/USDT": "bitcoin",
  "ETH/USDT": "ethereum",
  "SOL/USDT": "solana",
};

async function getFallbackSnapshot(): Promise<Partial<Record<PairSymbol, PriceSourceQuote>>> {
  const ids = [...Object.values(coinIds), "tether"].join(",");
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      { signal: AbortSignal.timeout(4_500) },
    );
    if (!response.ok) return {};
    const data = (await response.json()) as Record<string, { usd?: number }>;
    const quoteUsd = data.tether?.usd;
    if (!quoteUsd || !Number.isFinite(quoteUsd) || quoteUsd <= 0) return {};
    const snapshot: Partial<Record<PairSymbol, PriceSourceQuote>> = {};
    for (const pair of Object.keys(coinIds) as PairSymbol[]) {
      const baseUsd = data[coinIds[pair]]?.usd;
      if (baseUsd && Number.isFinite(baseUsd) && baseUsd > 0) {
        snapshot[pair] = { pair, source: "coingecko", price: baseUsd / quoteUsd, timestampMs: Date.now() };
      }
    }
    return snapshot;
  } catch {
    return {};
  }
}

export async function getHostedFeeds(privateKeyHex: string) {
  const binance = new BinanceFeed();
  const okx = new OkxFeed();
  const ckb = new CkbTipSynchronizer();
  // Only fetch snapshots. The long-running service also starts sockets and timers.
  const [, , tip, fallback] = await Promise.all([
    binance.fetchRestSnapshot(),
    okx.fetchRestSnapshot(),
    ckb.refresh(),
    getFallbackSnapshot(),
  ]);
  if (!tip) throw new Error("CKB tip unavailable");

  const aggregator = new OracleAggregator({
    privateKeyHex,
    binanceFeed: binance,
    okxFeed: okx,
    ckbSync: ckb,
    coingeckoFeed: { getQuote: async (pair) => fallback[pair] ?? null },
  });
  const feeds = await aggregator.recomputeAll();
  if (!feeds.length) throw new Error("Price sources unavailable");
  return {
    version: 1,
    publisherPubkey: aggregator.getPublisherPubkey(),
    ckbTip: tip,
    updatedAtMs: aggregator.getLastUpdatedMs(),
    feeds,
  };
}

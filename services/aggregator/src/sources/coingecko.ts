import { SUPPORTED_PAIRS, type PairSymbol, type PriceSourceQuote } from '../types.js';

const COINGECKO_IDS: Record<PairSymbol, string> = {
  'CKB/USDT': 'nervos-network',
  'BTC/USDT': 'bitcoin',
  'ETH/USDT': 'ethereum',
  'SOL/USDT': 'solana',
};

export class CoinGeckoFallbackFeed {
  private cache = new Map<PairSymbol, PriceSourceQuote>();
  private lastFetchMs = 0;
  private inFlight: Promise<void> | null = null;
  private readonly minRefreshIntervalMs: number;

  constructor(minRefreshIntervalMs: number = 15000) {
    this.minRefreshIntervalMs = minRefreshIntervalMs;
  }

  getCachedQuote(pair: PairSymbol): PriceSourceQuote | null {
    return this.cache.get(pair) ?? null;
  }

  async getQuote(pair: PairSymbol): Promise<PriceSourceQuote | null> {
    const now = Date.now();
    if (now - this.lastFetchMs > this.minRefreshIntervalMs || !this.cache.has(pair)) {
      await this.refreshAll();
    }
    return this.cache.get(pair) ?? null;
  }

  async refreshAll(): Promise<void> {
    if (this.inFlight) {
      return this.inFlight;
    }

    this.inFlight = (async () => {
      const ids = Object.values(COINGECKO_IDS).join(',');
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Record<string, { usd?: number }>;
        const now = Date.now();
        for (const pair of SUPPORTED_PAIRS) {
          const cgId = COINGECKO_IDS[pair];
          const price = data[cgId]?.usd;
          if (typeof price === 'number' && Number.isFinite(price) && price > 0) {
            this.cache.set(pair, {
              source: 'coingecko',
              pair,
              price,
              timestampMs: now,
            });
          }
        }
        this.lastFetchMs = now;
      } catch (err) {
        console.warn(`[coingecko] fallback fetch error:`, (err as Error).message);
      } finally {
        this.inFlight = null;
      }
    })();

    return this.inFlight;
  }
}

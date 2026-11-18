import { EventEmitter } from 'node:events';
import { CkbTipSynchronizer } from './ckbSync.js';
import {
  getPublisherPubkeyHex,
  PRICE_DECIMALS,
  resolvePublisherPrivateKey,
  scalePrice,
  signOraclePayload,
} from './crypto.js';
import {
  aggregateQuotesWithCircuitBreaker,
  computeMaxDeviationPercent,
  DEFAULT_DEVIATION_THRESHOLD_PERCENT,
} from './median.js';
import { BinanceFeed } from './sources/binance.js';
import { CoinGeckoFallbackFeed } from './sources/coingecko.js';
import { OkxFeed } from './sources/okx.js';
import {
  SUPPORTED_PAIRS,
  type CanonicalOraclePayload,
  type CkbTipHeader,
  type PairSymbol,
  type PriceSourceQuote,
  type SignedOracleFeed,
} from './types.js';

export interface QuoteProvider {
  getQuote(pair: PairSymbol): PriceSourceQuote | null;
  start?(): Promise<void>;
  stop?(): void;
}

export interface FallbackProvider {
  getQuote(pair: PairSymbol): Promise<PriceSourceQuote | null>;
  getCachedQuote?(pair: PairSymbol): PriceSourceQuote | null;
}

export interface TipProvider {
  getLatestTip(): CkbTipHeader | null;
  getRpcUrl(): string;
  start?(): Promise<void>;
  stop?(): void;
  refresh?(): Promise<CkbTipHeader | null>;
}

export interface AggregatorOptions {
  privateKeyHex?: string;
  deviationThresholdPercent?: number;
  binanceFeed?: QuoteProvider;
  okxFeed?: QuoteProvider;
  coingeckoFeed?: FallbackProvider;
  ckbSync?: TipProvider;
  recomputeIntervalMs?: number;
}

export function normalizePairInput(rawPair: string): PairSymbol | null {
  const normalized = rawPair.trim().toUpperCase().replace('-', '/').replace('_', '/');
  if ((SUPPORTED_PAIRS as readonly string[]).includes(normalized)) {
    return normalized as PairSymbol;
  }
  return null;
}

export class OracleAggregator extends EventEmitter {
  private readonly privateKeyBytes: Uint8Array;
  private readonly pubkeyHex: string;
  private readonly deviationThresholdPercent: number;
  private readonly binance: QuoteProvider;
  private readonly okx: QuoteProvider;
  private readonly coingecko: FallbackProvider;
  private readonly ckbSync: TipProvider;
  private readonly recomputeIntervalMs: number;

  private feeds = new Map<PairSymbol, SignedOracleFeed>();
  private recomputeTimer: NodeJS.Timeout | null = null;
  private lastUpdatedMs: number | null = null;
  private startedAtMs = Date.now();
  private recomputing = false;

  constructor(options: AggregatorOptions = {}) {
    super();
    this.privateKeyBytes = resolvePublisherPrivateKey(options.privateKeyHex);
    this.pubkeyHex = getPublisherPubkeyHex(this.privateKeyBytes);
    this.deviationThresholdPercent =
      options.deviationThresholdPercent ?? DEFAULT_DEVIATION_THRESHOLD_PERCENT;
    this.recomputeIntervalMs = options.recomputeIntervalMs ?? 1500;

    this.binance = options.binanceFeed ?? new BinanceFeed();
    this.okx = options.okxFeed ?? new OkxFeed();
    this.coingecko = options.coingeckoFeed ?? new CoinGeckoFallbackFeed();
    this.ckbSync = options.ckbSync ?? new CkbTipSynchronizer();
  }

  getPublisherPubkey(): string {
    return this.pubkeyHex;
  }

  getCkbRpcUrl(): string {
    return this.ckbSync.getRpcUrl();
  }

  getCkbTip(): CkbTipHeader | null {
    return this.ckbSync.getLatestTip();
  }

  getStartedAtMs(): number {
    return this.startedAtMs;
  }

  getLastUpdatedMs(): number | null {
    return this.lastUpdatedMs;
  }

  getAllFeeds(): SignedOracleFeed[] {
    const out: SignedOracleFeed[] = [];
    for (const pair of SUPPORTED_PAIRS) {
      const feed = this.feeds.get(pair);
      if (feed) out.push(feed);
    }
    return out;
  }

  getFeed(pairInput: string): SignedOracleFeed | null {
    const pair = normalizePairInput(pairInput);
    if (!pair) return null;
    return this.feeds.get(pair) ?? null;
  }

  async recomputeAll(): Promise<SignedOracleFeed[]> {
    if (this.recomputing) {
      return this.getAllFeeds();
    }
    this.recomputing = true;

    try {
      let tip = this.ckbSync.getLatestTip();
      if (!tip && this.ckbSync.refresh) {
        tip = await this.ckbSync.refresh();
      }
      if (!tip) {
        return this.getAllFeeds();
      }

      const updated: SignedOracleFeed[] = [];
      for (const pair of SUPPORTED_PAIRS) {
        const tier1: PriceSourceQuote[] = [];
        const b = this.binance.getQuote(pair);
        if (b) tier1.push(b);
        const o = this.okx.getQuote(pair);
        if (o) tier1.push(o);

        const spread = computeMaxDeviationPercent(tier1.map((q) => q.price));
        let fallbackQuote: PriceSourceQuote | null = null;
        if (tier1.length < 2 || spread > this.deviationThresholdPercent) {
          fallbackQuote = await this.coingecko.getQuote(pair);
        }

        if (tier1.length === 0 && !fallbackQuote) {
          continue;
        }

        const agg = aggregateQuotesWithCircuitBreaker(
          tier1,
          fallbackQuote,
          this.deviationThresholdPercent
        );

        const now = Date.now();
        const flags =
          (agg.circuitBreaker.fallbackUsed ? 1 : 0) | (agg.circuitBreaker.tripped ? 2 : 0);

        const payload: CanonicalOraclePayload = {
          magic: 'ORCL',
          version: 1,
          pair,
          priceScaled: scalePrice(agg.medianPrice, PRICE_DECIMALS).toString(),
          decimals: PRICE_DECIMALS,
          price: agg.medianPrice,
          timestampMs: now,
          blockNumber: tip.blockNumber,
          tipBlockHash: tip.tipBlockHash,
          blockTimestampMs: tip.blockTimestampMs,
          sourceCount: agg.acceptedQuotes.length,
          flags,
        };

        const signed = signOraclePayload(
          payload,
          this.privateKeyBytes,
          agg.acceptedQuotes,
          agg.circuitBreaker
        );

        this.feeds.set(pair, signed);
        updated.push(signed);
      }

      if (updated.length > 0) {
        this.lastUpdatedMs = Date.now();
        this.emit('feeds', updated);
      }
      return updated;
    } finally {
      this.recomputing = false;
    }
  }

  async start(): Promise<void> {
    this.startedAtMs = Date.now();
    await Promise.all([
      this.ckbSync.start?.(),
      this.binance.start?.(),
      this.okx.start?.(),
    ]);
    await this.recomputeAll();

    this.recomputeTimer = setInterval(() => {
      void this.recomputeAll();
    }, this.recomputeIntervalMs);
  }

  stop(): void {
    if (this.recomputeTimer) {
      clearInterval(this.recomputeTimer);
      this.recomputeTimer = null;
    }
    this.binance.stop?.();
    this.okx.stop?.();
    this.ckbSync.stop?.();
  }
}

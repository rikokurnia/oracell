import { describe, expect, it } from 'vitest';
import {
  aggregateQuotesWithCircuitBreaker,
  computeMaxDeviationPercent,
  computeMedian,
  percentDeviationFrom,
} from '../src/median.js';
import type { PriceSourceQuote } from '../src/types.js';

describe('median & deviation circuit breaker', () => {
  it('computes deterministic median for odd and even counts regardless of input order', () => {
    expect(computeMedian([100, 102, 101])).toBe(101);
    expect(computeMedian([64400, 64500, 64300, 64600])).toBe(64450);
    expect(computeMedian([0.000899])).toBe(0.000899);
    expect(() => computeMedian([])).toThrow();
  });

  it('computes percentage deviation accurately', () => {
    expect(percentDeviationFrom(102.5, 100)).toBeCloseTo(2.5, 4);
    expect(computeMaxDeviationPercent([100, 101])).toBeCloseTo(0.4975, 3);
  });

  it('passes cleanly without fallback when Binance and OKX agree within 2%', () => {
    const tier1: PriceSourceQuote[] = [
      { source: 'binance', pair: 'BTC/USDT', price: 64400, timestampMs: 1000 },
      { source: 'okx', pair: 'BTC/USDT', price: 64500, timestampMs: 1000 },
    ];
    const result = aggregateQuotesWithCircuitBreaker(tier1, null, 2.0);
    expect(result.medianPrice).toBe(64450);
    expect(result.acceptedQuotes).toHaveLength(2);
    expect(result.circuitBreaker.triggered).toBe(false);
    expect(result.circuitBreaker.tripped).toBe(false);
    expect(result.circuitBreaker.fallbackUsed).toBe(false);
  });

  it('triggers CoinGecko fallback and scrubs >2% outlier when Tier 1 diverges', () => {
    // OKX flash-spike (+10%) vs Binance; CoinGecko confirms Binance
    const tier1: PriceSourceQuote[] = [
      { source: 'binance', pair: 'ETH/USDT', price: 1800, timestampMs: 1000 },
      { source: 'okx', pair: 'ETH/USDT', price: 1980, timestampMs: 1000 },
    ];
    const fallback: PriceSourceQuote = {
      source: 'coingecko',
      pair: 'ETH/USDT',
      price: 1805,
      timestampMs: 1000,
    };

    const result = aggregateQuotesWithCircuitBreaker(tier1, fallback, 2.0);
    expect(result.circuitBreaker.triggered).toBe(true);
    expect(result.circuitBreaker.fallbackUsed).toBe(true);
    expect(result.circuitBreaker.tripped).toBe(false);
    expect(result.circuitBreaker.scrubbedSources).toEqual(['okx']);
    expect(result.acceptedQuotes.map((q) => q.source)).toEqual(['binance', 'coingecko']);
    expect(result.medianPrice).toBe(1802.5);
  });

  it('marks circuitBreaker.tripped=true if 2 sources diverge >2% and fallback is unavailable', () => {
    const tier1: PriceSourceQuote[] = [
      { source: 'binance', pair: 'SOL/USDT', price: 70, timestampMs: 1000 },
      { source: 'okx', pair: 'SOL/USDT', price: 80, timestampMs: 1000 },
    ];

    const result = aggregateQuotesWithCircuitBreaker(tier1, null, 2.0);
    expect(result.circuitBreaker.triggered).toBe(true);
    expect(result.circuitBreaker.tripped).toBe(true);
    expect(result.medianPrice).toBe(75);
  });

  it('uses CoinGecko fallback when only 1 Tier 1 exchange lists the pair (e.g. CKB/USDT)', () => {
    const tier1: PriceSourceQuote[] = [
      { source: 'binance', pair: 'CKB/USDT', price: 0.0009, timestampMs: 1000 },
    ];
    const fallback: PriceSourceQuote = {
      source: 'coingecko',
      pair: 'CKB/USDT',
      price: 0.000902,
      timestampMs: 1000,
    };

    const result = aggregateQuotesWithCircuitBreaker(tier1, fallback, 2.0);
    expect(result.circuitBreaker.fallbackUsed).toBe(true);
    expect(result.circuitBreaker.tripped).toBe(false);
    expect(result.acceptedQuotes).toHaveLength(2);
    expect(result.medianPrice).toBeCloseTo(0.000901, 8);
  });
});

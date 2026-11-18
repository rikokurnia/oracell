import type { CircuitBreakerStatus, PriceSourceQuote, SourceName } from './types.js';

export const DEFAULT_DEVIATION_THRESHOLD_PERCENT = 2.0;

/**
 * Deterministic median calculation.
 * - Odd length: middle element
 * - Even length: arithmetic mean of the two middle elements
 */
export function computeMedian(values: number[]): number {
  if (values.length === 0) {
    throw new Error('Cannot compute median of empty array');
  }
  const valid = values.filter((v) => Number.isFinite(v) && v > 0);
  if (valid.length === 0) {
    throw new Error('No valid positive finite values for median');
  }
  const sorted = [...valid].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Computes percentage deviation of a value from a reference median.
 */
export function percentDeviationFrom(value: number, reference: number): number {
  if (reference <= 0) return 0;
  return (Math.abs(value - reference) / reference) * 100;
}

/**
 * Computes maximum pairwise percentage spread relative to the median.
 */
export function computeMaxDeviationPercent(prices: number[]): number {
  if (prices.length < 2) return 0;
  const median = computeMedian(prices);
  let maxDev = 0;
  for (const p of prices) {
    const dev = percentDeviationFrom(p, median);
    if (dev > maxDev) maxDev = dev;
  }
  return Number(maxDev.toFixed(4));
}

export interface AggregationResult {
  medianPrice: number;
  acceptedQuotes: PriceSourceQuote[];
  circuitBreaker: CircuitBreakerStatus;
}

/**
 * Evaluates Tier 1 quotes (Binance / OKX) and optional CoinGecko fallback quote,
 * enforcing the >2% deviation circuit breaker.
 *
 * Behavior:
 * 1. If Tier 1 quotes diverge by > thresholdPercent (2.0%) or fewer than 2 quotes exist,
 *    CoinGecko fallback is consulted.
 * 2. When >= 3 total quotes exist and spread exceeds thresholdPercent, quotes deviating
 *    > thresholdPercent from the 3-source median are scrubbed as outliers.
 * 3. If remaining accepted quotes still exceed thresholdPercent spread (e.g. only 2 quotes
 *    disagreeing by >2% with no tie-breaker), `tripped` is set to true so downstream consumers
 *    can inspect the circuit-breaker flag, while still emitting the deterministic median.
 */
export function aggregateQuotesWithCircuitBreaker(
  tier1Quotes: PriceSourceQuote[],
  coingeckoFallbackQuote: PriceSourceQuote | null,
  thresholdPercent: number = DEFAULT_DEVIATION_THRESHOLD_PERCENT
): AggregationResult {
  const validTier1 = tier1Quotes.filter((q) => Number.isFinite(q.price) && q.price > 0);
  const tier1Spread = computeMaxDeviationPercent(validTier1.map((q) => q.price));
  const needsFallback = validTier1.length < 2 || tier1Spread > thresholdPercent;

  const combined: PriceSourceQuote[] = [...validTier1];
  let fallbackUsed = false;

  if (needsFallback && coingeckoFallbackQuote && Number.isFinite(coingeckoFallbackQuote.price) && coingeckoFallbackQuote.price > 0) {
    if (!combined.some((q) => q.source === 'coingecko')) {
      combined.push(coingeckoFallbackQuote);
      fallbackUsed = true;
    }
  }

  if (combined.length === 0) {
    throw new Error('No valid price quotes available from any source');
  }

  const initialMedian = computeMedian(combined.map((q) => q.price));
  const initialSpread = computeMaxDeviationPercent(combined.map((q) => q.price));

  let acceptedQuotes = [...combined];
  const scrubbedSources: SourceName[] = [];
  let triggered = tier1Spread > thresholdPercent || fallbackUsed;
  let reason: string | undefined;

  if (initialSpread > thresholdPercent) {
    triggered = true;
    if (combined.length >= 3) {
      const inBounds = combined.filter(
        (q) => percentDeviationFrom(q.price, initialMedian) <= thresholdPercent
      );
      if (inBounds.length >= 2) {
        for (const q of combined) {
          if (!inBounds.includes(q)) {
            scrubbedSources.push(q.source);
          }
        }
        acceptedQuotes = inBounds;
        reason = `Outlier scrubbed (${scrubbedSources.join(', ')}) exceeding ${thresholdPercent}% deviation`;
      } else {
        reason = `Multi-source spread (${initialSpread.toFixed(2)}%) exceeds ${thresholdPercent}% threshold`;
      }
    } else {
      reason = `2-source spread (${initialSpread.toFixed(2)}%) exceeds ${thresholdPercent}% threshold`;
    }
  } else if (fallbackUsed && validTier1.length < 2) {
    reason = `Tier 1 single-source fallback engaged (CoinGecko)`;
  }

  const finalMedian = computeMedian(acceptedQuotes.map((q) => q.price));
  const finalSpread = computeMaxDeviationPercent(acceptedQuotes.map((q) => q.price));
  const tripped = finalSpread > thresholdPercent;

  return {
    medianPrice: finalMedian,
    acceptedQuotes,
    circuitBreaker: {
      thresholdPercent,
      triggered,
      tripped,
      fallbackUsed,
      maxDeviationPercent: finalSpread,
      scrubbedSources,
      reason,
    },
  };
}

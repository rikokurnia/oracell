export const SUPPORTED_PAIRS = ['CKB/USDT', 'BTC/USDT', 'ETH/USDT', 'SOL/USDT'] as const;

export type PairSymbol = (typeof SUPPORTED_PAIRS)[number];

export type SourceName = 'binance' | 'okx' | 'coingecko';

export interface PriceSourceQuote {
  source: SourceName;
  pair: PairSymbol;
  price: number;
  timestampMs: number;
}

export interface CkbTipHeader {
  tipBlockHash: string; // 0x-prefixed 32-byte hex
  blockNumber: number;
  blockTimestampMs: number;
  epoch: string;
  fetchedAtMs: number;
}

export interface CircuitBreakerStatus {
  thresholdPercent: number; // e.g. 2.0
  triggered: boolean; // true if >2% deviation detected or Tier 1 needed fallback
  tripped: boolean; // true if consensus could not stabilize within threshold
  fallbackUsed: boolean;
  maxDeviationPercent: number;
  scrubbedSources: SourceName[];
  reason?: string;
}

export interface CanonicalOraclePayload {
  magic: 'ORCL';
  version: 1;
  pair: PairSymbol;
  /** Integer price scaled by 10^8 (e.g. 0.000899 -> 89900) */
  priceScaled: string;
  decimals: 8;
  /** Human-readable float price */
  price: number;
  timestampMs: number;
  blockNumber: number;
  tipBlockHash: string;
  blockTimestampMs: number;
  sourceCount: number;
  flags: number;
}

export interface SignedOracleFeed {
  pair: PairSymbol;
  pairKey: string; // e.g. "CKB_USDT"
  payload: CanonicalOraclePayload;
  /** 88-byte canonical payload as 0x-prefixed hex */
  payloadHex: string;
  /** 32-byte SHA-256 digest of payload bytes as 0x-prefixed hex */
  digestHex: string;
  /** 32-byte x-only BIP-340 Schnorr public key (MuSig2/FROST-compatible) */
  pubkey: string;
  /** 64-byte Schnorr signature over payload digest */
  signature: string;
  /** 184-byte complete Oracell Witness envelope (payload || pubkey || signature) */
  witnessHex: string;
  /** Individual exchange quotes contributing to this round */
  sources: PriceSourceQuote[];
  circuitBreaker: CircuitBreakerStatus;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  version: string;
  port: number;
  uptimeMs: number;
  publisherPubkey: string;
  ckbRpcUrl: string;
  ckbTip: CkbTipHeader | null;
  pairCount: number;
  activePairs: PairSymbol[];
  lastUpdatedMs: number | null;
}

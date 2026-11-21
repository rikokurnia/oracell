export const SUPPORTED_PAIRS = ['CKB/USDT', 'BTC/USDT', 'ETH/USDT', 'SOL/USDT'] as const;

export type PairSymbol = (typeof SUPPORTED_PAIRS)[number];
export type PairInput = PairSymbol | 'CKB_USDT' | 'BTC_USDT' | 'ETH_USDT' | 'SOL_USDT' | string;

export type SourceName = 'binance' | 'okx' | 'coingecko';

export interface PriceSourceQuote {
  source: SourceName;
  pair: PairSymbol;
  price: number;
  timestampMs: number;
}

export interface CkbTipHeader {
  tipBlockHash: string;
  blockNumber: number;
  blockTimestampMs: number;
  epoch: string;
  fetchedAtMs?: number;
}

export interface CircuitBreakerStatus {
  thresholdPercent: number;
  triggered: boolean;
  tripped: boolean;
  fallbackUsed: boolean;
  maxDeviationPercent: number;
  scrubbedSources: SourceName[];
  reason?: string;
}

export interface CanonicalOraclePayload {
  magic: 'ORCL';
  version: 1;
  pair: PairSymbol;
  priceScaled: string;
  decimals: 8;
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
  pairKey: string;
  payload: CanonicalOraclePayload;
  payloadHex: string;
  digestHex: string;
  pubkey: string;
  signature: string;
  witnessHex: string;
  sources: PriceSourceQuote[];
  circuitBreaker: CircuitBreakerStatus;
}

export interface FeedsResponse {
  version: number;
  publisherPubkey: string;
  ckbTip: CkbTipHeader | null;
  updatedAtMs: number | null;
  feeds: SignedOracleFeed[];
}

export interface DecodedOracleWitness {
  payload: CanonicalOraclePayload;
  pubkey: string;
  signature: string;
  payloadHex: string;
  digestHex: string;
}

export interface CkbCellDep {
  outPoint?: { txHash: string; index: string };
  out_point?: { tx_hash: string; index: string };
  depType?: string;
  dep_type?: string;
}

export interface CkbCellInput {
  previousOutput?: { txHash: string; index: string };
  previous_output?: { tx_hash: string; index: string };
  since: string;
}

export interface CkbTransactionSkeleton {
  version?: string;
  cellDeps?: CkbCellDep[];
  cell_deps?: CkbCellDep[];
  headerDeps?: string[];
  header_deps?: string[];
  inputs?: CkbCellInput[];
  outputs?: unknown[];
  outputsData?: string[];
  outputs_data?: string[];
  witnesses?: string[];
  [key: string]: unknown;
}

export interface InjectOracleProofOptions {
  /**
   * When true, wraps the 184-byte Oracell witness inside CKB Molecule WitnessArgs
   * in the chosen field (`output_type` by default). Defaults to false (raw 184B Oracell witness).
   */
  wrapInWitnessArgs?: boolean;
  /** Target WitnessArgs field when wrapInWitnessArgs is true (default: 'output_type') */
  witnessField?: 'input_type' | 'output_type';
  /** Optional explicit witness slot index; if omitted, appends to witnesses */
  witnessIndex?: number;
}

export interface OracellClientConfig {
  aggregatorUrl?: string;
  ckbRpcUrl?: string;
  fetchImpl?: typeof fetch;
}

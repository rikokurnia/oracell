import { verifyOracleSignature } from './codec.js';
import type {
  CkbTipHeader,
  FeedsResponse,
  OracellClientConfig,
  PairInput,
  SignedOracleFeed,
} from './types.js';

export const DEFAULT_AGGREGATOR_URL = 'https://oracell.vercel.app';
export const DEFAULT_CKB_RPC_URL = 'https://testnet.ckbapp.dev/';

function normalizePairQuery(pair: PairInput): string {
  return pair.trim().toUpperCase().replace('/', '_').replace('-', '_');
}

export class OracellClient {
  readonly aggregatorUrl: string;
  readonly ckbRpcUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: OracellClientConfig = {}) {
    this.aggregatorUrl = (config.aggregatorUrl ?? DEFAULT_AGGREGATOR_URL).replace(/\/+$/, '');
    this.ckbRpcUrl = config.ckbRpcUrl ?? DEFAULT_CKB_RPC_URL;
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async getHealth(): Promise<Record<string, unknown>> {
    const res = await this.fetchImpl(`${this.aggregatorUrl}/health`);
    if (!res.ok) {
      throw new Error(`Oracell aggregator /health returned HTTP ${res.status}`);
    }
    return (await res.json()) as Record<string, unknown>;
  }

  async getAllFeeds(): Promise<FeedsResponse> {
    const res = await this.fetchImpl(`${this.aggregatorUrl}/v1/oracle/feeds`);
    if (!res.ok) {
      throw new Error(`Oracell aggregator /v1/oracle/feeds returned HTTP ${res.status}`);
    }
    return (await res.json()) as FeedsResponse;
  }

  async getLatestPrice(pair: PairInput): Promise<SignedOracleFeed> {
    const pairParam = encodeURIComponent(normalizePairQuery(pair));
    const res = await this.fetchImpl(`${this.aggregatorUrl}/v1/oracle/quote?pair=${pairParam}`);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to fetch quote for ${pair}: HTTP ${res.status} ${text}`);
    }
    return (await res.json()) as SignedOracleFeed;
  }

  async getTipHeader(): Promise<CkbTipHeader> {
    const res = await this.fetchImpl(this.ckbRpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'get_tip_header',
        params: [],
      }),
    });
    if (!res.ok) {
      throw new Error(`CKB RPC get_tip_header HTTP ${res.status}`);
    }
    const json = (await res.json()) as {
      result?: { hash: string; number: string; timestamp: string; epoch: string };
      error?: { message: string };
    };
    if (json.error || !json.result) {
      throw new Error(`CKB RPC error: ${json.error?.message ?? 'missing result'}`);
    }
    return {
      tipBlockHash: json.result.hash,
      blockNumber: Number(BigInt(json.result.number)),
      blockTimestampMs: Number(BigInt(json.result.timestamp)),
      epoch: json.result.epoch,
      fetchedAtMs: Date.now(),
    };
  }

  verifyFeed(feed: SignedOracleFeed, expectedPubkeyHex?: string): boolean {
    return verifyOracleSignature(feed, expectedPubkeyHex);
  }
}

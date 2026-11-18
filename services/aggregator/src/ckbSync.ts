import type { CkbTipHeader } from './types.js';

export const DEFAULT_CKB_RPC_URL = 'https://testnet.ckbapp.dev/';

interface JsonRpcHeaderResult {
  hash: string;
  number: string;
  timestamp: string;
  epoch: string;
}

interface JsonRpcResponse<T> {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: { code: number; message: string };
}

export async function fetchCkbTipHeader(
  rpcUrl: string = DEFAULT_CKB_RPC_URL,
  timeoutMs: number = 5000
): Promise<CkbTipHeader> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'get_tip_header',
        params: [],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`CKB RPC HTTP ${res.status}`);
    }

    const body = (await res.json()) as JsonRpcResponse<JsonRpcHeaderResult>;
    if (body.error || !body.result) {
      throw new Error(`CKB RPC error: ${body.error?.message ?? 'empty result'}`);
    }

    return {
      tipBlockHash: body.result.hash,
      blockNumber: Number(BigInt(body.result.number)),
      blockTimestampMs: Number(BigInt(body.result.timestamp)),
      epoch: body.result.epoch,
      fetchedAtMs: Date.now(),
    };
  } finally {
    clearTimeout(timer);
  }
}

export class CkbTipSynchronizer {
  private latestTip: CkbTipHeader | null = null;
  private timer: NodeJS.Timeout | null = null;
  private readonly rpcUrl: string;
  private readonly pollIntervalMs: number;
  private readonly onTipUpdate?: (tip: CkbTipHeader) => void;

  constructor(options?: {
    rpcUrl?: string;
    pollIntervalMs?: number;
    onTipUpdate?: (tip: CkbTipHeader) => void;
  }) {
    this.rpcUrl = options?.rpcUrl ?? process.env.CKB_RPC_URL ?? DEFAULT_CKB_RPC_URL;
    this.pollIntervalMs = options?.pollIntervalMs ?? 3000;
    this.onTipUpdate = options?.onTipUpdate;
  }

  getRpcUrl(): string {
    return this.rpcUrl;
  }

  getLatestTip(): CkbTipHeader | null {
    return this.latestTip;
  }

  async refresh(): Promise<CkbTipHeader | null> {
    try {
      const tip = await fetchCkbTipHeader(this.rpcUrl);
      const changed = this.latestTip?.tipBlockHash !== tip.tipBlockHash;
      this.latestTip = tip;
      if (changed && this.onTipUpdate) {
        this.onTipUpdate(tip);
      }
      return tip;
    } catch (err) {
      console.warn(`[ckbSync] get_tip_header failed:`, (err as Error).message);
      return this.latestTip;
    }
  }

  async start(): Promise<void> {
    await this.refresh();
    this.timer = setInterval(() => {
      void this.refresh();
    }, this.pollIntervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

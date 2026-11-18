import WebSocket from 'ws';
import { SUPPORTED_PAIRS, type PairSymbol, type PriceSourceQuote } from '../types.js';

const OKX_INST_IDS: Record<PairSymbol, string> = {
  'CKB/USDT': 'CKB-USDT',
  'BTC/USDT': 'BTC-USDT',
  'ETH/USDT': 'ETH-USDT',
  'SOL/USDT': 'SOL-USDT',
};

const INST_TO_PAIR = new Map<string, PairSymbol>(
  Object.entries(OKX_INST_IDS).map(([pair, instId]) => [instId, pair as PairSymbol])
);

export class OkxFeed {
  private quotes = new Map<PairSymbol, PriceSourceQuote>();
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private stopped = false;
  private readonly onQuote?: (quote: PriceSourceQuote) => void;

  constructor(onQuote?: (quote: PriceSourceQuote) => void) {
    this.onQuote = onQuote;
  }

  getQuote(pair: PairSymbol): PriceSourceQuote | null {
    return this.quotes.get(pair) ?? null;
  }

  async fetchRestSnapshot(): Promise<void> {
    try {
      const res = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SPOT', {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as {
        code: string;
        data?: Array<{ instId: string; last: string; ts: string }>;
      };
      if (body.code !== '0' || !Array.isArray(body.data)) return;

      for (const item of body.data) {
        const pair = INST_TO_PAIR.get(item.instId);
        if (!pair) continue;
        const price = Number.parseFloat(item.last);
        const ts = Number.parseInt(item.ts, 10);
        if (Number.isFinite(price) && price > 0) {
          const quote: PriceSourceQuote = {
            source: 'okx',
            pair,
            price,
            timestampMs: Number.isFinite(ts) ? ts : Date.now(),
          };
          this.quotes.set(pair, quote);
          this.onQuote?.(quote);
        }
      }
    } catch (err) {
      console.warn(`[okx] REST snapshot error:`, (err as Error).message);
    }
  }

  connectWebSocket(): void {
    if (this.stopped) return;
    const ws = new WebSocket('wss://ws.okx.com:8443/ws/v5/public');
    this.ws = ws;

    ws.on('open', () => {
      const args = SUPPORTED_PAIRS.map((pair) => ({
        channel: 'tickers',
        instId: OKX_INST_IDS[pair],
      }));
      ws.send(JSON.stringify({ op: 'subscribe', args }));

      this.pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send('ping');
        }
      }, 25000);
    });

    ws.on('message', (raw) => {
      const str = raw.toString();
      if (str === 'pong') return;
      try {
        const parsed = JSON.parse(str) as {
          data?: Array<{ instId?: string; last?: string; ts?: string }>;
        };
        if (!Array.isArray(parsed.data)) return;
        for (const item of parsed.data) {
          if (!item.instId || !item.last) continue;
          const pair = INST_TO_PAIR.get(item.instId);
          const price = Number.parseFloat(item.last);
          const ts = item.ts ? Number.parseInt(item.ts, 10) : Date.now();
          if (pair && Number.isFinite(price) && price > 0) {
            const quote: PriceSourceQuote = {
              source: 'okx',
              pair,
              price,
              timestampMs: Number.isFinite(ts) ? ts : Date.now(),
            };
            this.quotes.set(pair, quote);
            this.onQuote?.(quote);
          }
        }
      } catch {
        // Ignore non-JSON control messages
      }
    });

    ws.on('error', (err) => {
      console.warn(`[okx] WS error:`, err.message);
    });

    ws.on('close', () => {
      if (this.pingTimer) {
        clearInterval(this.pingTimer);
        this.pingTimer = null;
      }
      if (!this.stopped) {
        this.reconnectTimer = setTimeout(() => this.connectWebSocket(), 5000);
      }
    });
  }

  async start(): Promise<void> {
    this.stopped = false;
    await this.fetchRestSnapshot();
    this.connectWebSocket();
  }

  stop(): void {
    this.stopped = true;
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}

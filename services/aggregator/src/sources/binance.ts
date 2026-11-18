import WebSocket from 'ws';
import { SUPPORTED_PAIRS, type PairSymbol, type PriceSourceQuote } from '../types.js';

const BINANCE_SYMBOLS: Record<PairSymbol, string> = {
  'CKB/USDT': 'CKBUSDT',
  'BTC/USDT': 'BTCUSDT',
  'ETH/USDT': 'ETHUSDT',
  'SOL/USDT': 'SOLUSDT',
};

const SYMBOL_TO_PAIR = new Map<string, PairSymbol>(
  Object.entries(BINANCE_SYMBOLS).map(([pair, sym]) => [sym, pair as PairSymbol])
);

export class BinanceFeed {
  private quotes = new Map<PairSymbol, PriceSourceQuote>();
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private stopped = false;
  private readonly onQuote?: (quote: PriceSourceQuote) => void;

  constructor(onQuote?: (quote: PriceSourceQuote) => void) {
    this.onQuote = onQuote;
  }

  getQuote(pair: PairSymbol): PriceSourceQuote | null {
    return this.quotes.get(pair) ?? null;
  }

  async fetchRestSnapshot(): Promise<void> {
    const symbolsParam = encodeURIComponent(JSON.stringify(Object.values(BINANCE_SYMBOLS)));
    const url = `https://api.binance.com/api/v3/ticker/price?symbols=${symbolsParam}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = (await res.json()) as Array<{ symbol: string; price: string }>;
      const now = Date.now();
      for (const row of rows) {
        const pair = SYMBOL_TO_PAIR.get(row.symbol);
        const price = Number.parseFloat(row.price);
        if (pair && Number.isFinite(price) && price > 0) {
          const quote: PriceSourceQuote = { source: 'binance', pair, price, timestampMs: now };
          this.quotes.set(pair, quote);
          this.onQuote?.(quote);
        }
      }
    } catch (err) {
      console.warn(`[binance] REST snapshot error:`, (err as Error).message);
    }
  }

  connectWebSocket(): void {
    if (this.stopped) return;
    const streams = SUPPORTED_PAIRS.map((p) => `${BINANCE_SYMBOLS[p].toLowerCase()}@ticker`).join('/');
    const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;

    const ws = new WebSocket(url);
    this.ws = ws;

    ws.on('message', (raw) => {
      try {
        const parsed = JSON.parse(raw.toString()) as { data?: { s?: string; c?: string; E?: number } };
        const data = parsed.data;
        if (!data?.s || !data?.c) return;
        const pair = SYMBOL_TO_PAIR.get(data.s);
        const price = Number.parseFloat(data.c);
        if (pair && Number.isFinite(price) && price > 0) {
          const quote: PriceSourceQuote = {
            source: 'binance',
            pair,
            price,
            timestampMs: data.E ?? Date.now(),
          };
          this.quotes.set(pair, quote);
          this.onQuote?.(quote);
        }
      } catch {
        // Ignore malformed tick frames
      }
    });

    ws.on('error', (err) => {
      console.warn(`[binance] WS error:`, err.message);
    });

    ws.on('close', () => {
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
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}

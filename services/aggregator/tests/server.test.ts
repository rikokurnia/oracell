import type http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OracleAggregator } from '../src/aggregator.js';
import { verifySignedOracleFeed } from '../src/crypto.js';
import { createAggregatorServer } from '../src/server.js';
import type { CkbTipHeader, PairSymbol, PriceSourceQuote, SignedOracleFeed } from '../src/types.js';

describe('aggregator HTTP & SSE endpoints', () => {
  let server: http.Server;
  let aggregator: OracleAggregator;
  let baseUrl: string;

  const mockTip: CkbTipHeader = {
    tipBlockHash: '0x2744652538156731685b79f596bc828099ca7280fc50de9f5db4b8c47da80118',
    blockNumber: 23099353,
    blockTimestampMs: 1794966398000,
    epoch: '0x70806a5003782',
    fetchedAtMs: 1794966400000,
  };

  const mockPrices: Record<PairSymbol, number> = {
    'CKB/USDT': 0.000899,
    'BTC/USDT': 64436.4,
    'ETH/USDT': 1807.4,
    'SOL/USDT': 74.38,
  };

  beforeAll(async () => {
    aggregator = new OracleAggregator({
      recomputeIntervalMs: 60_000,
      binanceFeed: {
        getQuote: (pair): PriceSourceQuote => ({
          source: 'binance',
          pair,
          price: mockPrices[pair],
          timestampMs: Date.now(),
        }),
      },
      okxFeed: {
        getQuote: (pair): PriceSourceQuote | null =>
          pair === 'CKB/USDT'
            ? null
            : {
                source: 'okx',
                pair,
                price: mockPrices[pair] * 1.0005,
                timestampMs: Date.now(),
              },
      },
      coingeckoFeed: {
        getQuote: async (pair): Promise<PriceSourceQuote> => ({
          source: 'coingecko',
          pair,
          price: mockPrices[pair] * 0.9995,
          timestampMs: Date.now(),
        }),
      },
      ckbSync: {
        getLatestTip: () => mockTip,
        getRpcUrl: () => 'https://testnet.ckbapp.dev/',
      },
    });

    await aggregator.recomputeAll();
    server = createAggregatorServer(aggregator, 0);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    aggregator.stop();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('GET /health returns status ok, CKB tip, and CORS headers', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    const json = (await res.json()) as { status: string; pairCount: number; ckbTip: CkbTipHeader };
    expect(json.status).toBe('ok');
    expect(json.pairCount).toBe(4);
    expect(json.ckbTip.tipBlockHash).toBe(mockTip.tipBlockHash);
  });

  it('GET /v1/oracle/feeds returns all 4 signed feeds', async () => {
    const res = await fetch(`${baseUrl}/v1/oracle/feeds`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { publisherPubkey: string; feeds: SignedOracleFeed[] };
    expect(json.feeds).toHaveLength(4);
    for (const feed of json.feeds) {
      expect(verifySignedOracleFeed(feed, json.publisherPubkey)).toBe(true);
    }
  });

  it('GET /v1/oracle/quote?pair=CKB_USDT returns single verifiable quote', async () => {
    const res = await fetch(`${baseUrl}/v1/oracle/quote?pair=CKB_USDT`);
    expect(res.status).toBe(200);
    const feed = (await res.json()) as SignedOracleFeed;
    expect(feed.pair).toBe('CKB/USDT');
    expect(feed.pairKey).toBe('CKB_USDT');
    expect(feed.payload.blockNumber).toBe(mockTip.blockNumber);
    expect(feed.payload.tipBlockHash).toBe(mockTip.tipBlockHash);
    expect(verifySignedOracleFeed(feed, aggregator.getPublisherPubkey())).toBe(true);
  });

  it('GET /v1/oracle/stream emits SSE feeds event immediately', async () => {
    const controller = new AbortController();
    const res = await fetch(`${baseUrl}/v1/oracle/stream`, { signal: controller.signal });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const reader = res.body!.getReader();
    const { value } = await reader.read();
    const chunk = new TextDecoder().decode(value);
    expect(chunk).toContain('event: feeds');
    expect(chunk).toContain('CKB/USDT');
    controller.abort();
  });
});

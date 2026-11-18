import http from 'node:http';
import { URL } from 'node:url';
import { normalizePairInput, type OracleAggregator } from './aggregator.js';
import type { HealthResponse, SignedOracleFeed } from './types.js';

function applyCorsHeaders(res: http.ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control');
}

function sendJson(res: http.ServerResponse, statusCode: number, body: unknown): void {
  applyCorsHeaders(res);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

export function createAggregatorServer(aggregator: OracleAggregator, port: number): http.Server {
  const sseClients = new Set<http.ServerResponse>();

  const onFeeds = (feeds: SignedOracleFeed[]) => {
    if (sseClients.size === 0) return;
    const payload = `event: feeds\ndata: ${JSON.stringify({
      timestampMs: Date.now(),
      feeds,
    })}\n\n`;
    for (const client of sseClients) {
      if (!client.writableEnded) {
        client.write(payload);
      }
    }
  };

  aggregator.on('feeds', onFeeds);

  const server = http.createServer((req, res) => {
    if (req.method === 'OPTIONS') {
      applyCorsHeaders(res);
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }

    const reqUrl = new URL(req.url ?? '/', `http://localhost:${port}`);
    const pathname = reqUrl.pathname;

    if (pathname === '/health') {
      const feeds = aggregator.getAllFeeds();
      const tip = aggregator.getCkbTip();
      const health: HealthResponse = {
        status: feeds.length > 0 && tip !== null ? 'ok' : 'degraded',
        service: 'oracell-aggregator',
        version: '0.1.0',
        port,
        uptimeMs: Date.now() - aggregator.getStartedAtMs(),
        publisherPubkey: aggregator.getPublisherPubkey(),
        ckbRpcUrl: aggregator.getCkbRpcUrl(),
        ckbTip: tip,
        pairCount: feeds.length,
        activePairs: feeds.map((f) => f.pair),
        lastUpdatedMs: aggregator.getLastUpdatedMs(),
      };
      sendJson(res, 200, health);
      return;
    }

    if (pathname === '/v1/oracle/feeds') {
      const feeds = aggregator.getAllFeeds();
      sendJson(res, 200, {
        version: 1,
        publisherPubkey: aggregator.getPublisherPubkey(),
        ckbTip: aggregator.getCkbTip(),
        updatedAtMs: aggregator.getLastUpdatedMs(),
        feeds,
      });
      return;
    }

    if (pathname === '/v1/oracle/quote') {
      const pairParam = reqUrl.searchParams.get('pair');
      if (!pairParam) {
        sendJson(res, 400, {
          error: 'Missing required query parameter: pair (e.g. ?pair=CKB_USDT)',
        });
        return;
      }

      const normalized = normalizePairInput(pairParam);
      if (!normalized) {
        sendJson(res, 400, {
          error: `Unsupported pair: ${pairParam}. Supported: CKB_USDT, BTC_USDT, ETH_USDT, SOL_USDT`,
        });
        return;
      }

      const feed = aggregator.getFeed(normalized);
      if (!feed) {
        sendJson(res, 503, {
          error: `Price feed for ${normalized} is not ready yet`,
        });
        return;
      }

      sendJson(res, 200, feed);
      return;
    }

    if (pathname === '/v1/oracle/stream') {
      applyCorsHeaders(res);
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      });

      sseClients.add(res);

      // Push initial snapshot immediately upon connect
      const initialFeeds = aggregator.getAllFeeds();
      res.write(
        `event: feeds\ndata: ${JSON.stringify({
          timestampMs: Date.now(),
          feeds: initialFeeds,
        })}\n\n`
      );

      const keepAlive = setInterval(() => {
        if (!res.writableEnded) {
          res.write(`: keepalive ${Date.now()}\n\n`);
        }
      }, 15000);

      req.on('close', () => {
        clearInterval(keepAlive);
        sseClients.delete(res);
      });
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  });

  server.on('close', () => {
    aggregator.off('feeds', onFeeds);
    for (const client of sseClients) {
      if (!client.writableEnded) {
        client.end();
      }
    }
    sseClients.clear();
  });

  return server;
}

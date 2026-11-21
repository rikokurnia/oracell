import { schnorr } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { describe, expect, it } from 'vitest';
import {
  decodeOracleWitness,
  encodeOracleWitness,
  encodePayloadBytes,
  encodeWitnessArgsWithOracle,
  injectOracleProof,
  OracellClient,
  verifyOracleSignature,
  WITNESS_SIZE,
  type CanonicalOraclePayload,
  type CkbTransactionSkeleton,
  type SignedOracleFeed,
} from '../src/index.js';

const TEST_PRIVKEY_HEX = '5b8215c2a1f4c8d9e7b3a1c5d6e8f0a2b4c6d8e0f1a3b5c7d9e1f3a5b7c9d1e3';

function makeSignedFeed(overrides: Partial<CanonicalOraclePayload> = {}): SignedOracleFeed {
  const privKey = hexToBytes(TEST_PRIVKEY_HEX);
  const pubkey = schnorr.getPublicKey(privKey);

  const payload: CanonicalOraclePayload = {
    magic: 'ORCL',
    version: 1,
    pair: 'CKB/USDT',
    priceScaled: '89900',
    decimals: 8,
    price: 0.000899,
    timestampMs: 1794966400000,
    blockNumber: 23099353,
    tipBlockHash: '0x2744652538156731685b79f596bc828099ca7280fc50de9f5db4b8c47da80118',
    blockTimestampMs: 1794966398000,
    sourceCount: 2,
    flags: 0,
    ...overrides,
  };

  const payloadBytes = encodePayloadBytes(payload);
  const digest = sha256(payloadBytes);
  const sig = schnorr.sign(digest, privKey);

  const witness = new Uint8Array(WITNESS_SIZE);
  witness.set(payloadBytes, 0);
  witness.set(pubkey, 88);
  witness.set(sig, 120);

  return {
    pair: payload.pair,
    pairKey: payload.pair.replace('/', '_'),
    payload,
    payloadHex: `0x${bytesToHex(payloadBytes)}`,
    digestHex: `0x${bytesToHex(digest)}`,
    pubkey: `0x${bytesToHex(pubkey)}`,
    signature: `0x${bytesToHex(sig)}`,
    witnessHex: `0x${bytesToHex(witness)}`,
    sources: [
      { source: 'binance', pair: payload.pair, price: payload.price, timestampMs: payload.timestampMs },
      { source: 'coingecko', pair: payload.pair, price: payload.price, timestampMs: payload.timestampMs },
    ],
    circuitBreaker: {
      thresholdPercent: 2.0,
      triggered: false,
      tripped: false,
      fallbackUsed: false,
      maxDeviationPercent: 0,
      scrubbedSources: [],
    },
  };
}

describe('@oracell/sdk', () => {
  it('encodes and decodes 184-byte Oracell witness and verifies Schnorr signature', () => {
    const feed = makeSignedFeed();
    const witnessHex = encodeOracleWitness(feed);
    expect(witnessHex).toBe(feed.witnessHex);
    expect((witnessHex.length - 2) / 2).toBe(184);

    const decoded = decodeOracleWitness(witnessHex);
    expect(decoded.payload.pair).toBe('CKB/USDT');
    expect(decoded.payload.priceScaled).toBe('89900');
    expect(decoded.payload.tipBlockHash).toBe(feed.payload.tipBlockHash);
    expect(decoded.pubkey).toBe(feed.pubkey);
    expect(decoded.signature).toBe(feed.signature);

    expect(verifyOracleSignature(feed, feed.pubkey)).toBe(true);
    expect(verifyOracleSignature(feed, `0x${'11'.repeat(32)}`)).toBe(false);
  });

  it('encodes valid Molecule WitnessArgs envelope around Oracell proof', () => {
    const feed = makeSignedFeed();
    const witnessArgsHex = encodeWitnessArgsWithOracle(feed, { field: 'output_type' });
    const raw = hexToBytes(witnessArgsHex.slice(2));
    const view = new DataView(raw.buffer);
    // Molecule WitnessArgs: total_size = 16 + 0 (lock) + 0 (input_type) + (4 + 184) (output_type) = 204
    expect(view.getUint32(0, true)).toBe(204);
    expect(view.getUint32(4, true)).toBe(16);
    expect(view.getUint32(8, true)).toBe(16);
    expect(view.getUint32(12, true)).toBe(16);
    expect(view.getUint32(16, true)).toBe(184);
    expect(String.fromCharCode(raw[20], raw[21], raw[22], raw[23])).toBe('ORCL');
  });

  it('injectOracleProof attaches headerDeps and witnesses without consuming any shared oracle cell', () => {
    const feed = makeSignedFeed();
    const baseTx: CkbTransactionSkeleton = {
      version: '0x0',
      cellDeps: [{ outPoint: { txHash: `0x${'aa'.repeat(32)}`, index: '0x0' }, depType: 'code' }],
      headerDeps: [],
      inputs: [{ previousOutput: { txHash: `0x${'bb'.repeat(32)}`, index: '0x0' }, since: '0x0' }],
      outputs: [{ capacity: '0x174876e800', lock: {}, type: null }],
      outputsData: ['0x'],
      witnesses: ['0x'],
    };

    const injected = injectOracleProof(baseTx, feed);
    // Non-mutating
    expect(baseTx.headerDeps).toHaveLength(0);
    expect(baseTx.witnesses).toHaveLength(1);

    // Proof attached, zero extra inputs/cellDeps consumed
    expect(injected.inputs).toEqual(baseTx.inputs);
    expect(injected.cellDeps).toEqual(baseTx.cellDeps);
    expect(injected.headerDeps).toEqual([feed.payload.tipBlockHash]);
    expect(injected.witnesses).toHaveLength(2);
    expect(injected.witnesses![1]).toBe(feed.witnessHex);

    // Idempotent headerDeps deduplication if injected twice
    const injectedTwice = injectOracleProof(injected, feed);
    expect(injectedTwice.headerDeps).toEqual([feed.payload.tipBlockHash]);
  });

  it('OracellClient fetches quotes, feeds, and CKB tip header', async () => {
    const feed = makeSignedFeed();
    const mockFetch: typeof fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/v1/oracle/quote?pair=CKB_USDT')) {
        return new Response(JSON.stringify(feed), { status: 200 });
      }
      if (url.endsWith('/v1/oracle/feeds')) {
        return new Response(
          JSON.stringify({
            version: 1,
            publisherPubkey: feed.pubkey,
            ckbTip: null,
            updatedAtMs: Date.now(),
            feeds: [feed],
          }),
          { status: 200 }
        );
      }
      if (init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: {
              hash: feed.payload.tipBlockHash,
              number: '0x16077d9',
              timestamp: '0x1a1e8f9c8c0',
              epoch: '0x70806a5003782',
            },
          }),
          { status: 200 }
        );
      }
      return new Response('not found', { status: 404 });
    };

    const client = new OracellClient({
      aggregatorUrl: 'http://localhost:4001',
      ckbRpcUrl: 'https://testnet.ckbapp.dev/',
      fetchImpl: mockFetch,
    });

    const latest = await client.getLatestPrice('CKB/USDT');
    expect(latest.payload.priceScaled).toBe('89900');
    expect(client.verifyFeed(latest, feed.pubkey)).toBe(true);

    const all = await client.getAllFeeds();
    expect(all.feeds).toHaveLength(1);

    const tip = await client.getTipHeader();
    expect(tip.tipBlockHash).toBe(feed.payload.tipBlockHash);
    expect(tip.blockNumber).toBe(23099353);
  });

  it('simulates 50 parallel transactions with zero shared oracle cell contention', () => {
    const feed = makeSignedFeed();
    const txCount = 50;

    const builtTxs = Array.from({ length: txCount }, (_, idx) => {
      const userOutPoint = {
        txHash: `0x${idx.toString(16).padStart(64, '0')}`,
        index: '0x0',
      };
      const baseTx: CkbTransactionSkeleton = {
        version: '0x0',
        cellDeps: [
          { outPoint: { txHash: `0x${'cc'.repeat(32)}`, index: '0x0' }, depType: 'depGroup' },
        ],
        headerDeps: [],
        inputs: [{ previousOutput: userOutPoint, since: '0x0' }],
        outputs: [{ capacity: '0x2540be400' }],
        outputsData: ['0x'],
        witnesses: ['0x'],
      };
      return injectOracleProof(baseTx, feed);
    });

    const consumedOutPoints = new Set<string>();
    for (const tx of builtTxs) {
      expect(tx.inputs).toHaveLength(1);
      const op = tx.inputs![0].previousOutput!;
      const key = `${op.txHash}:${op.index}`;
      expect(consumedOutPoints.has(key)).toBe(false);
      consumedOutPoints.add(key);

      expect(tx.headerDeps).toEqual([feed.payload.tipBlockHash]);
      const decoded = decodeOracleWitness(tx.witnesses![1]);
      expect(decoded.payload.tipBlockHash).toBe(feed.payload.tipBlockHash);
    }
    expect(consumedOutPoints.size).toBe(txCount);
  });
});

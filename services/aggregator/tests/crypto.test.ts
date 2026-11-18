import { describe, expect, it } from 'vitest';
import {
  decodePayloadBytes,
  encodePayloadBytes,
  from0xHex,
  getPublisherPubkeyHex,
  PAYLOAD_SIZE,
  resolvePublisherPrivateKey,
  scalePrice,
  signOraclePayload,
  verifySignedOracleFeed,
  WITNESS_SIZE,
} from '../src/crypto.js';
import type { CanonicalOraclePayload } from '../src/types.js';

describe('canonical encoding & Schnorr signature verification', () => {
  const privKey = resolvePublisherPrivateKey();
  const pubkeyHex = getPublisherPubkeyHex(privKey);

  const samplePayload: CanonicalOraclePayload = {
    magic: 'ORCL',
    version: 1,
    pair: 'CKB/USDT',
    priceScaled: scalePrice(0.000899).toString(),
    decimals: 8,
    price: 0.000899,
    timestampMs: 1794966400000,
    blockNumber: 23099353,
    tipBlockHash: '0x2744652538156731685b79f596bc828099ca7280fc50de9f5db4b8c47da80118',
    blockTimestampMs: 1794966398000,
    sourceCount: 2,
    flags: 0,
  };

  it('round-trips canonical 88-byte payload deterministically', () => {
    const bytes = encodePayloadBytes(samplePayload);
    expect(bytes.length).toBe(PAYLOAD_SIZE);

    const decoded = decodePayloadBytes(bytes);
    expect(decoded.magic).toBe('ORCL');
    expect(decoded.version).toBe(1);
    expect(decoded.pair).toBe('CKB/USDT');
    expect(decoded.priceScaled).toBe('89900');
    expect(decoded.decimals).toBe(8);
    expect(decoded.price).toBeCloseTo(0.000899, 8);
    expect(decoded.timestampMs).toBe(samplePayload.timestampMs);
    expect(decoded.blockNumber).toBe(samplePayload.blockNumber);
    expect(decoded.tipBlockHash).toBe(samplePayload.tipBlockHash);
    expect(decoded.blockTimestampMs).toBe(samplePayload.blockTimestampMs);
    expect(decoded.sourceCount).toBe(2);
    expect(decoded.flags).toBe(0);
  });

  it('produces valid 64-byte Schnorr signature and 184-byte witness envelope', () => {
    const signed = signOraclePayload(
      samplePayload,
      privKey,
      [
        { source: 'binance', pair: 'CKB/USDT', price: 0.000899, timestampMs: 1794966400000 },
        { source: 'coingecko', pair: 'CKB/USDT', price: 0.000899, timestampMs: 1794966400000 },
      ],
      {
        thresholdPercent: 2.0,
        triggered: false,
        tripped: false,
        fallbackUsed: true,
        maxDeviationPercent: 0,
        scrubbedSources: [],
      }
    );

    expect(from0xHex(signed.pubkey).length).toBe(32);
    expect(from0xHex(signed.signature).length).toBe(64);
    expect(from0xHex(signed.witnessHex).length).toBe(WITNESS_SIZE);
    expect(verifySignedOracleFeed(signed, pubkeyHex)).toBe(true);
  });

  it('rejects tampered price, tampered tipBlockHash, or wrong pubkey', () => {
    const signed = signOraclePayload(
      samplePayload,
      privKey,
      [{ source: 'binance', pair: 'CKB/USDT', price: 0.000899, timestampMs: 1794966400000 }],
      {
        thresholdPercent: 2.0,
        triggered: false,
        tripped: false,
        fallbackUsed: false,
        maxDeviationPercent: 0,
        scrubbedSources: [],
      }
    );

    const tamperedPrice = {
      ...signed,
      payload: { ...signed.payload, priceScaled: '999999' },
    };
    expect(verifySignedOracleFeed(tamperedPrice, pubkeyHex)).toBe(false);

    const tamperedHash = {
      ...signed,
      payload: {
        ...signed.payload,
        tipBlockHash: '0x' + '11'.repeat(32),
      },
    };
    expect(verifySignedOracleFeed(tamperedHash, pubkeyHex)).toBe(false);

    const wrongPubkey = '0x' + '22'.repeat(32);
    expect(verifySignedOracleFeed(signed, wrongPubkey)).toBe(false);
  });
});

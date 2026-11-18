import { schnorr } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import type {
  CanonicalOraclePayload,
  CircuitBreakerStatus,
  PairSymbol,
  PriceSourceQuote,
  SignedOracleFeed,
} from './types.js';

export const PAYLOAD_SIZE = 88;
export const PUBKEY_SIZE = 32;
export const SIGNATURE_SIZE = 64;
export const WITNESS_SIZE = PAYLOAD_SIZE + PUBKEY_SIZE + SIGNATURE_SIZE; // 184 bytes
export const ORACELL_MAGIC = new Uint8Array([0x4f, 0x52, 0x43, 0x4c]); // "ORCL"
export const ORACELL_VERSION = 1;
export const PRICE_DECIMALS = 8;

/**
 * Deterministic testnet/development publisher private key (32 bytes).
 * Override in production via ORACELL_PUBLISHER_PRIVATE_KEY.
 */
export const DEFAULT_TEST_PUBLISHER_PRIVATE_KEY =
  '0x5b8215c2a1f4c8d9e7b3a1c5d6e8f0a2b4c6d8e0f1a3b5c7d9e1f3a5b7c9d1e3';

export function normalizeHex(hex: string): string {
  const clean = hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex;
  return clean.toLowerCase();
}

export function to0xHex(bytes: Uint8Array): string {
  return `0x${bytesToHex(bytes)}`;
}

export function from0xHex(hex: string): Uint8Array {
  return hexToBytes(normalizeHex(hex));
}

export function resolvePublisherPrivateKey(overrideHex?: string): Uint8Array {
  const raw = overrideHex ?? process.env.ORACELL_PUBLISHER_PRIVATE_KEY ?? DEFAULT_TEST_PUBLISHER_PRIVATE_KEY;
  const bytes = from0xHex(raw);
  if (bytes.length !== 32) {
    throw new Error(`Invalid publisher private key length: expected 32 bytes, got ${bytes.length}`);
  }
  return bytes;
}

export function getPublisherPubkeyHex(privateKeyBytes: Uint8Array): string {
  return to0xHex(schnorr.getPublicKey(privateKeyBytes));
}

export function scalePrice(price: number, decimals: number = PRICE_DECIMALS): bigint {
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Invalid price to scale: ${price}`);
  }
  const factor = 10 ** decimals;
  return BigInt(Math.round(price * factor));
}

export function unscalePrice(priceScaled: bigint, decimals: number = PRICE_DECIMALS): number {
  return Number(priceScaled) / 10 ** decimals;
}

/**
 * Encodes an oracle payload into the canonical 88-byte little-endian binary layout:
 * - [0..4]   magic = "ORCL" (4B)
 * - [4]      version = 1 (1B)
 * - [5..21]  pair UTF-8 ASCII null-padded (16B)
 * - [21..29] priceScaled u64 LE (8B)
 * - [29]     decimals u8 = 8 (1B)
 * - [30..38] timestampMs u64 LE (8B)
 * - [38..46] blockNumber u64 LE (8B)
 * - [46..78] tipBlockHash 32B (32B)
 * - [78..86] blockTimestampMs u64 LE (8B)
 * - [86]     sourceCount u8 (1B)
 * - [87]     flags u8 (1B)
 */
export function encodePayloadBytes(payload: CanonicalOraclePayload): Uint8Array {
  const buf = new Uint8Array(PAYLOAD_SIZE);
  const view = new DataView(buf.buffer);

  buf.set(ORACELL_MAGIC, 0);
  buf[4] = payload.version;

  const pairBytes = new TextEncoder().encode(payload.pair);
  if (pairBytes.length > 16) {
    throw new Error(`Pair symbol exceeds 16 bytes: ${payload.pair}`);
  }
  buf.set(pairBytes, 5);

  view.setBigUint64(21, BigInt(payload.priceScaled), true);
  buf[29] = payload.decimals;
  view.setBigUint64(30, BigInt(payload.timestampMs), true);
  view.setBigUint64(38, BigInt(payload.blockNumber), true);

  const tipHashBytes = from0xHex(payload.tipBlockHash);
  if (tipHashBytes.length !== 32) {
    throw new Error(`tipBlockHash must be 32 bytes, got ${tipHashBytes.length}`);
  }
  buf.set(tipHashBytes, 46);

  view.setBigUint64(78, BigInt(payload.blockTimestampMs), true);
  buf[86] = payload.sourceCount & 0xff;
  buf[87] = payload.flags & 0xff;

  return buf;
}

export function decodePayloadBytes(bytes: Uint8Array): CanonicalOraclePayload {
  if (bytes.length !== PAYLOAD_SIZE) {
    throw new Error(`Invalid payload length: expected ${PAYLOAD_SIZE}, got ${bytes.length}`);
  }
  for (let i = 0; i < 4; i++) {
    if (bytes[i] !== ORACELL_MAGIC[i]) {
      throw new Error('Invalid Oracell magic header');
    }
  }
  const version = bytes[4];
  if (version !== ORACELL_VERSION) {
    throw new Error(`Unsupported Oracell version: ${version}`);
  }

  const pairSlice = bytes.slice(5, 21);
  const nullIdx = pairSlice.indexOf(0);
  const pair = new TextDecoder().decode(nullIdx === -1 ? pairSlice : pairSlice.slice(0, nullIdx)) as PairSymbol;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const priceScaled = view.getBigUint64(21, true);
  const decimals = bytes[29] as 8;
  const timestampMs = Number(view.getBigUint64(30, true));
  const blockNumber = Number(view.getBigUint64(38, true));
  const tipBlockHash = to0xHex(bytes.slice(46, 78));
  const blockTimestampMs = Number(view.getBigUint64(78, true));
  const sourceCount = bytes[86];
  const flags = bytes[87];

  return {
    magic: 'ORCL',
    version: 1,
    pair,
    priceScaled: priceScaled.toString(),
    decimals,
    price: unscalePrice(priceScaled, decimals),
    timestampMs,
    blockNumber,
    tipBlockHash,
    blockTimestampMs,
    sourceCount,
    flags,
  };
}

export function computePayloadDigest(payloadBytes: Uint8Array): Uint8Array {
  return sha256(payloadBytes);
}

export function signOraclePayload(
  payload: CanonicalOraclePayload,
  privateKeyBytes: Uint8Array,
  sources: PriceSourceQuote[],
  circuitBreaker: CircuitBreakerStatus
): SignedOracleFeed {
  const payloadBytes = encodePayloadBytes(payload);
  const digest = computePayloadDigest(payloadBytes);
  const pubkeyBytes = schnorr.getPublicKey(privateKeyBytes);
  const sigBytes = schnorr.sign(digest, privateKeyBytes);

  const witnessBytes = new Uint8Array(WITNESS_SIZE);
  witnessBytes.set(payloadBytes, 0);
  witnessBytes.set(pubkeyBytes, PAYLOAD_SIZE);
  witnessBytes.set(sigBytes, PAYLOAD_SIZE + PUBKEY_SIZE);

  return {
    pair: payload.pair,
    pairKey: payload.pair.replace('/', '_'),
    payload,
    payloadHex: to0xHex(payloadBytes),
    digestHex: to0xHex(digest),
    pubkey: to0xHex(pubkeyBytes),
    signature: to0xHex(sigBytes),
    witnessHex: to0xHex(witnessBytes),
    sources,
    circuitBreaker,
  };
}

export function verifySignedOracleFeed(feed: SignedOracleFeed, expectedPubkeyHex?: string): boolean {
  const payloadBytes = encodePayloadBytes(feed.payload);
  if (to0xHex(payloadBytes) !== feed.payloadHex.toLowerCase()) {
    return false;
  }
  const digest = computePayloadDigest(payloadBytes);
  if (to0xHex(digest) !== feed.digestHex.toLowerCase()) {
    return false;
  }
  if (expectedPubkeyHex && normalizeHex(feed.pubkey) !== normalizeHex(expectedPubkeyHex)) {
    return false;
  }
  const sigBytes = from0xHex(feed.signature);
  const pubkeyBytes = from0xHex(feed.pubkey);
  if (sigBytes.length !== SIGNATURE_SIZE || pubkeyBytes.length !== PUBKEY_SIZE) {
    return false;
  }
  return schnorr.verify(sigBytes, digest, pubkeyBytes);
}

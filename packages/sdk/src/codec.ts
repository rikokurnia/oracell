import { schnorr } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import type {
  CanonicalOraclePayload,
  DecodedOracleWitness,
  PairSymbol,
  SignedOracleFeed,
} from './types.js';

export const PAYLOAD_SIZE = 88;
export const PUBKEY_SIZE = 32;
export const SIGNATURE_SIZE = 64;
export const WITNESS_SIZE = PAYLOAD_SIZE + PUBKEY_SIZE + SIGNATURE_SIZE; // 184 bytes
export const ORACELL_MAGIC = new Uint8Array([0x4f, 0x52, 0x43, 0x4c]); // "ORCL"
export const ORACELL_VERSION = 1;

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
    price: Number(priceScaled) / 10 ** decimals,
    timestampMs,
    blockNumber,
    tipBlockHash,
    blockTimestampMs,
    sourceCount,
    flags,
  };
}

/**
 * Serializes a signed oracle payload into the deterministic 184-byte Oracell Witness hex:
 * [88B canonical payload] || [32B x-only Schnorr pubkey] || [64B Schnorr signature]
 */
export function encodeOracleWitness(signedPayload: SignedOracleFeed): string {
  const payloadBytes = encodePayloadBytes(signedPayload.payload);
  const pubkeyBytes = from0xHex(signedPayload.pubkey);
  const sigBytes = from0xHex(signedPayload.signature);

  if (pubkeyBytes.length !== PUBKEY_SIZE) {
    throw new Error(`Invalid pubkey length: expected 32 bytes, got ${pubkeyBytes.length}`);
  }
  if (sigBytes.length !== SIGNATURE_SIZE) {
    throw new Error(`Invalid signature length: expected 64 bytes, got ${sigBytes.length}`);
  }

  const witness = new Uint8Array(WITNESS_SIZE);
  witness.set(payloadBytes, 0);
  witness.set(pubkeyBytes, PAYLOAD_SIZE);
  witness.set(sigBytes, PAYLOAD_SIZE + PUBKEY_SIZE);
  return to0xHex(witness);
}

/**
 * Decodes a 184-byte Oracell witness hex string back into structured payload + pubkey + signature.
 */
export function decodeOracleWitness(witnessHex: string): DecodedOracleWitness {
  const bytes = from0xHex(witnessHex);
  if (bytes.length !== WITNESS_SIZE) {
    throw new Error(`Invalid Oracell witness length: expected ${WITNESS_SIZE}, got ${bytes.length}`);
  }
  const payloadBytes = bytes.slice(0, PAYLOAD_SIZE);
  const pubkeyBytes = bytes.slice(PAYLOAD_SIZE, PAYLOAD_SIZE + PUBKEY_SIZE);
  const sigBytes = bytes.slice(PAYLOAD_SIZE + PUBKEY_SIZE, WITNESS_SIZE);

  return {
    payload: decodePayloadBytes(payloadBytes),
    pubkey: to0xHex(pubkeyBytes),
    signature: to0xHex(sigBytes),
    payloadHex: to0xHex(payloadBytes),
    digestHex: to0xHex(sha256(payloadBytes)),
  };
}

function encodeMoleculeBytesOpt(data: Uint8Array | null): Uint8Array {
  if (!data) return new Uint8Array(0);
  const out = new Uint8Array(4 + data.length);
  new DataView(out.buffer).setUint32(0, data.length, true);
  out.set(data, 4);
  return out;
}

/**
 * Encodes a CKB Molecule `WitnessArgs` table with the Oracell proof placed in
 * `input_type` or `output_type`, compatible with standard CKB lock+type transactions.
 */
export function encodeWitnessArgsWithOracle(
  signedPayload: SignedOracleFeed,
  options?: { field?: 'input_type' | 'output_type'; lockHex?: string }
): string {
  const oracleBytes = from0xHex(encodeOracleWitness(signedPayload));
  const field = options?.field ?? 'output_type';
  const lockBytes = options?.lockHex ? from0xHex(options.lockHex) : null;

  const f0 = encodeMoleculeBytesOpt(lockBytes);
  const f1 = encodeMoleculeBytesOpt(field === 'input_type' ? oracleBytes : null);
  const f2 = encodeMoleculeBytesOpt(field === 'output_type' ? oracleBytes : null);

  const headerSize = 16; // total_size(4) + 3 * offset(4)
  const totalSize = headerSize + f0.length + f1.length + f2.length;
  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);

  view.setUint32(0, totalSize, true);
  view.setUint32(4, headerSize, true);
  view.setUint32(8, headerSize + f0.length, true);
  view.setUint32(12, headerSize + f0.length + f1.length, true);

  out.set(f0, headerSize);
  out.set(f1, headerSize + f0.length);
  out.set(f2, headerSize + f0.length + f1.length);
  return to0xHex(out);
}

/**
 * Verifies the BIP-340 Schnorr signature on a SignedOracleFeed.
 */
export function verifyOracleSignature(
  signedPayload: SignedOracleFeed,
  expectedPubkeyHex?: string
): boolean {
  const payloadBytes = encodePayloadBytes(signedPayload.payload);
  const digest = sha256(payloadBytes);

  if (expectedPubkeyHex && normalizeHex(signedPayload.pubkey) !== normalizeHex(expectedPubkeyHex)) {
    return false;
  }
  const pubkeyBytes = from0xHex(signedPayload.pubkey);
  const sigBytes = from0xHex(signedPayload.signature);
  if (pubkeyBytes.length !== PUBKEY_SIZE || sigBytes.length !== SIGNATURE_SIZE) {
    return false;
  }
  return schnorr.verify(sigBytes, digest, pubkeyBytes);
}

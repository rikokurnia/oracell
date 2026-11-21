import { encodeOracleWitness, encodeWitnessArgsWithOracle, normalizeHex } from './codec.js';
import type {
  CkbTransactionSkeleton,
  InjectOracleProofOptions,
  SignedOracleFeed,
} from './types.js';

/**
 * Injects an Oracell signed oracle proof into a CKB transaction skeleton without
 * consuming or referencing any shared oracle cell (zero cell contention).
 *
 * - Adds `signedPayload.payload.tipBlockHash` to `headerDeps` / `header_deps` (idempotent).
 * - Encodes and inserts/appends the Oracell Witness into `witnesses`.
 * - Returns a new cloned transaction skeleton (non-mutating).
 */
export function injectOracleProof<T extends CkbTransactionSkeleton>(
  txSkeleton: T,
  signedPayload: SignedOracleFeed,
  options: InjectOracleProofOptions = {}
): T {
  const tipHash = signedPayload.payload.tipBlockHash;
  if (!/^0x[0-9a-fA-F]{64}$/.test(tipHash)) {
    throw new Error(`Invalid tipBlockHash in signedPayload: ${tipHash}`);
  }

  const encodedWitness = options.wrapInWitnessArgs
    ? encodeWitnessArgsWithOracle(signedPayload, {
        field: options.witnessField ?? 'output_type',
      })
    : encodeOracleWitness(signedPayload);

  const usesSnakeCase = 'header_deps' in txSkeleton && !('headerDeps' in txSkeleton);
  const existingHeaderDeps = usesSnakeCase
    ? [...(txSkeleton.header_deps ?? [])]
    : [...(txSkeleton.headerDeps ?? [])];

  const normalizedTip = normalizeHex(tipHash);
  const alreadyPresent = existingHeaderDeps.some((h) => normalizeHex(h) === normalizedTip);
  if (!alreadyPresent) {
    existingHeaderDeps.push(tipHash);
  }

  const nextWitnesses = [...(txSkeleton.witnesses ?? [])];
  if (options.witnessIndex !== undefined) {
    while (nextWitnesses.length <= options.witnessIndex) {
      nextWitnesses.push('0x');
    }
    nextWitnesses[options.witnessIndex] = encodedWitness;
  } else {
    nextWitnesses.push(encodedWitness);
  }

  const result: CkbTransactionSkeleton = {
    ...txSkeleton,
    witnesses: nextWitnesses,
  };

  if (usesSnakeCase) {
    result.header_deps = existingHeaderDeps;
  } else {
    result.headerDeps = existingHeaderDeps;
  }

  return result as T;
}

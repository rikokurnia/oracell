export const sdkCode = `import {
  OracellClient,
  encodeOracleWitness,
  injectOracleProof,
  type CkbTransactionSkeleton,
} from '@oracell/sdk';

const client = new OracellClient();
const quote = await client.getLatestPrice('CKB/USDT');
// Pin the publisher key from your trusted deployment configuration.
const expectedPubkey = process.env.ORACELL_PUBLISHER_PUBKEY;
if (!expectedPubkey || !client.verifyFeed(quote, expectedPubkey)) {
  throw new Error('Untrusted oracle signature');
}
const witnessHex = encodeOracleWitness(quote); // 184 bytes
// Add the proof to a transaction already prepared by your application.
const attachProof = (tx: CkbTransactionSkeleton) =>
  injectOracleProof(tx, quote);`;

export const payloadFields = [
  ["magic", "0–4", "4", 'ASCII "ORCL"'],
  ["version", "4–5", "1", "u8: 1"],
  ["pair", "5–21", "16", "Null-padded ASCII: CKB/USDT"],
  ["priceScaled", "21–29", "8", "u64 little-endian, decimal string in JSON"],
  ["decimals", "29–30", "1", "u8: 8; price = priceScaled / 10^8"],
  ["timestampMs", "30–38", "8", "u64 little-endian, milliseconds"],
  ["blockNumber", "38–46", "8", "u64 little-endian, CKB anchor height"],
  ["tipBlockHash", "46–78", "32", "Raw CKB block hash"],
  ["blockTimestampMs", "78–86", "8", "u64 little-endian, anchor timestamp"],
  ["sourceCount", "86–87", "1", "u8: contributing price sources"],
  [
    "flags",
    "87–88",
    "1",
    "Bit 0: fallback source; bit 1: circuit breaker tripped",
  ],
  ["pubkey", "88–120", "32", "X-only BIP-340 publisher public key"],
  [
    "signature",
    "120–184",
    "64",
    "Schnorr signature over SHA-256(payload bytes 0–88)",
  ],
];
export const verifierErrors = [
  [
    "1",
    "InvalidScriptArgs",
    "Expected 32-byte public key, optionally followed by an 8-byte lag limit.",
  ],
  [
    "2",
    "WitnessNotFound",
    "No Oracell proof found in the transaction witnesses.",
  ],
  [
    "3",
    "InvalidWitnessFormat",
    "Invalid length, magic, version, or witness encoding.",
  ],
  [
    "4",
    "PubkeyMismatch",
    "The proof publisher differs from the script-args public key.",
  ],
  ["5", "InvalidSignature", "BIP-340 signature validation failed."],
  [
    "6",
    "TipHeaderNotInDeps",
    "The signed anchor hash is missing from header dependencies.",
  ],
  [
    "7",
    "BlockNumberMismatch",
    "The matching header height differs from the signed payload.",
  ],
  [
    "8",
    "StaleOracleBlock",
    "The anchor exceeds the permitted lag relative to the highest supplied header.",
  ],
  [
    "9",
    "SysError",
    "The CKB-VM could not load required transaction or script data.",
  ],
];
export const docsSections = [
  {
    id: "verification-flow",
    title: "Verification flow",
    body: "Fetch a SignedOracleFeed, verify it with a trusted publisher public key, and use injectOracleProof to attach its witness and anchor header to your transaction. The CKB-VM type script locates a raw 184-byte proof or one inside WitnessArgs.input_type/output_type, checks ORCL magic and version, matches the publisher against script args, verifies BIP-340 over SHA-256 of the 88-byte payload, then checks the referenced header hash and height. Script args contain a 32-byte publisher key, optionally followed by a little-endian u64 maximum block lag (default: 2). Freshness is measured against the highest header supplied in header_deps, not an independently queried chain tip. Consumers must apply their own freshness, pair, source, and circuit-breaker policies. Phase 1 uses a single BIP-340 publisher. Phase 3 is intended to introduce distributed key generation and threshold Schnorr signing.",
  },
  {
    id: "read-a-price",
    title: "Read a Price",
    body: "Use client.getLatestPrice('CKB/USDT') for a signed quote, or client.getAllFeeds() for the current snapshot. Supported pairs are CKB/USDT, BTC/USDT, ETH/USDT, and SOL/USDT; slash, underscore, and hyphen query formats are accepted. Preserve payload.priceScaled as a decimal string and use payload.decimals (8) for display. getLatestPrice does not automatically verify the signature; call client.verifyFeed(quote, expectedPubkey) with a separately trusted publisher key before using the quote.",
  },
  {
    id: "build-a-witness",
    title: "Build a Witness",
    body: "encodeOracleWitness(quote) produces a 184-byte hex proof: 88 bytes of canonical payload, 32 bytes of x-only public key, and 64 bytes of Schnorr signature. decodeOracleWitness(witnessHex) returns the payload and signature fields. encodeWitnessArgsWithOracle(quote, { field: 'output_type', lockHex }) wraps the proof in Molecule WitnessArgs; input_type is also supported. Preserve any lock witness required by your transaction. injectOracleProof appends a raw proof by default; optional wrapInWitnessArgs, witnessField, and witnessIndex select a wrapper and slot. An explicit slot replaces its existing contents, so prepare witness placement deliberately.",
  },
  {
    id: "header-dependencies",
    title: "Attach Header Dependencies",
    body: "injectOracleProof(txSkeleton, quote) returns a new transaction skeleton with the proof in witnesses and payload.tipBlockHash added to headerDeps, or header_deps when the input uses that convention. The anchor hash is deduplicated. The helper does not add the deployed verifier cell dependency, construct a consuming type script, sign lock witnesses, or submit the transaction; your application must prepare those parts. client.getTipHeader() queries the configured CKB RPC. Its default is https://testnet.ckbapp.dev/; override ckbRpcUrl for your deployment. Enforce a suitable relationship to the actual chain tip in your consuming application.",
  },
  {
    id: "feed-identifiers",
    title: "Feed Identifiers",
    body: "Feeds are identified by their pair and pairKey: CKB/USDT → CKB_USDT, BTC/USDT → BTC_USDT, ETH/USDT → ETH_USDT, and SOL/USDT → SOL_USDT. On the hosted API, GET /api/oracle/quote?pair=CKB_USDT returns a SignedOracleFeed and GET /api/oracle/feeds returns the signed snapshot. SDK-compatible /v1/oracle paths resolve to these routes. Only the standalone service exposes the SSE stream. The hosted explorer polls its signed snapshot endpoint every 15 seconds; it does not present historical returns or charts that the API does not supply.",
  },
  {
    id: "payload-structure",
    title: "Payload Structure",
    body: "SignedOracleFeed contains pair, pairKey, payload, payloadHex, digestHex, pubkey, signature, witnessHex, sources, and circuitBreaker. The signed canonical payload is exactly 88 bytes. The JSON-only price is a numeric convenience value derived from priceScaled and decimals; it is not an additional binary field. Source details and the circuitBreaker object are outside the canonical signed bytes; sourceCount and flags are included. All u64 fields use little-endian encoding. Offsets below are half-open byte ranges in the complete 184-byte proof.",
  },
  {
    id: "sdk-methods",
    title: "SDK Methods",
    body: "OracellClient accepts aggregatorUrl, ckbRpcUrl, and an optional fetchImpl. Methods: getHealth(), getAllFeeds(), getLatestPrice(pair), getTipHeader(), and verifyFeed(feed, expectedPubkey?). Exported helpers include encodePayloadBytes, decodePayloadBytes, encodeOracleWitness, decodeOracleWitness, encodeWitnessArgsWithOracle, verifyOracleSignature, and injectOracleProof. Constants PAYLOAD_SIZE, PUBKEY_SIZE, SIGNATURE_SIZE, and WITNESS_SIZE are 88, 32, 64, and 184 respectively. The SDK supports ESM, CommonJS, and TypeScript declarations. For this repository, build it with npm --prefix packages/sdk run build and install it in your consuming application from the local packages/sdk directory.",
  },
  {
    id: "verifier-errors",
    title: "Verifier Errors",
    body: "The verifier exits with 0 on success. Failure codes below are defined by contracts/oracell-core. A valid signature alone does not prove that the transaction selected a sufficiently recent chain header or an acceptable market pair; apply consuming-contract policy alongside these checks.",
  },
  {
    id: "next-steps",
    title: "Next steps",
    body: "Configure your aggregator URL and trusted publisher key, fetch and verify a quote, and attach its proof to a transaction that includes your consuming script and verifier dependency. Review header freshness and circuit-breaker policies before signing and submitting. The frontend displays the aggregator response; it does not execute CKB-VM verification or authorize transactions.",
  },
  {
    id: "changelog",
    title: "Changelog",
    body: "The explorer now reads current signed feeds from the aggregator. Documentation matches the SDK client, 184-byte proof encoding, proof injection helper, and CKB-VM verifier error codes.",
  },
];
export const pageText = `# Build with Oracell\n\nIntegrate signed market data into your CKB application.\n\n## Start with the SDK\n\n${sdkCode}\n\n${docsSections.map((s) => `## ${s.title}\n\n${s.body}${s.id === "payload-structure" ? "\n\nField | Offset | Bytes | Encoding\n" + payloadFields.map((row) => row.join(" | ")).join("\n") : ""}${s.id === "verifier-errors" ? "\n\nCode | Error | Meaning\n" + verifierErrors.map((row) => row.join(" | ")).join("\n") : ""}`).join("\n\n")}`;

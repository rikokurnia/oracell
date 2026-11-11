export const sdkCode = `import { OracellClient } from '@oracell/sdk';

const client = new OracellClient();
const price = await client.getLatestPrice('CKB/USD');

console.log(price);`;
export const docsSections = [
  {
    id: "verification-flow",
    title: "Verification flow",
    body: "A consuming application retrieves a price payload, prepares a transaction witness, and attaches the referenced CKB header. Signature and header checks belong in the consuming transaction’s verification flow.",
  },
  {
    id: "read-a-price",
    title: "Read a Price",
    body: "Choose a market pair such as CKB/USD, BTC/USD, ETH/USD, or USDT/USD. Price values use a mantissa and exponent; retain that precision when preparing transaction data.",
  },
  {
    id: "build-a-witness",
    title: "Build a Witness",
    body: "The witness carries the price payload and its signature alongside the application’s transaction data. Keep the original payload intact when constructing the witness.",
  },
  {
    id: "header-dependencies",
    title: "Attach Header Dependencies",
    body: "Include the CKB header referenced by the payload in header_deps. Check the anchor and the permitted block window before accepting a price.",
  },
  {
    id: "feed-identifiers",
    title: "Feed Identifiers",
    body: "Use the Market Data explorer to find the supported pairs. The shortened identifiers shown in the explorer are for display; transaction integrations require complete feed identifiers.",
  },
  {
    id: "payload-structure",
    title: "Payload Structure",
    body: "A price payload describes its market, price, exponent, header anchor, and signature. Preserve numeric precision and validate all required fields before use.",
  },
  {
    id: "sdk-methods",
    title: "SDK Methods",
    body: "The integration interface describes getLatestPrice(pair), buildOracleWitness(payload), and injectHeaderDeps(txSkeleton). Use these methods to prepare price data for your transaction.",
  },
  {
    id: "verifier-errors",
    title: "Verifier Errors",
    body: "Handle missing header dependencies, invalid signatures, unknown feed identifiers, and stale anchors explicitly. Reject unusable payloads before submitting a transaction.",
  },
  {
    id: "next-steps",
    title: "Next steps",
    body: "Explore the available markets, choose a feed, and review the witness and header dependency requirements for your application.",
  },
  {
    id: "changelog",
    title: "Changelog",
    body: "The initial documentation covers market pairs, price payloads, and the CKB transaction integration flow.",
  },
];
export const pageText = `# Build with Oracell\n\nIntegrate signed market data into your CKB application.\n\n## Start with the SDK\n\n${sdkCode}\n\n${docsSections.map((s) => `## ${s.title}\n\n${s.body}`).join("\n\n")}`;

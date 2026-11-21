# `@oracell/sdk`

TypeScript Client SDK for Oracell — the decentralized, contention-free oracle network on Nervos CKB.

## API

```ts
import { OracellClient, encodeOracleWitness, injectOracleProof } from '@oracell/sdk';

const client = new OracellClient({
  aggregatorUrl: 'http://localhost:4001',
  ckbRpcUrl: 'https://testnet.ckbapp.dev/',
});

const quote = await client.getLatestPrice('CKB/USDT');
const witnessHex = encodeOracleWitness(quote);
const txWithProof = injectOracleProof(txSkeleton, quote);
```

## Scripts
- `npm run build` — Build ESM, CJS, and TypeScript declarations (`dist/`)
- `npm test` — Run Vitest unit & 50-tx parallel contention-free simulation tests
- `npm run example` — Run live aggregator + CKB Testnet integration script

## Install and call the hosted oracle

Node.js 22 or later. Build the package from the repository root and install it into your own project.

```sh
npm --prefix packages/sdk ci
npm --prefix packages/sdk run build
npm install /absolute/path/to/oracell/packages/sdk
```

```ts
import { OracellClient, encodeOracleWitness } from '@oracell/sdk';

const client = new OracellClient(); // https://oracell.vercel.app
const quote = await client.getLatestPrice('CKB/USDT');
const pinnedKey = process.env.ORACELL_PUBLISHER_PUBKEY;
if (!pinnedKey || !client.verifyFeed(quote, pinnedKey)) {
  throw new Error('Untrusted quote signature');
}
console.log(encodeOracleWitness(quote));
```

`getHealth()`, `getAllFeeds()`, and `getLatestPrice()` work against the hosted service. Pass `aggregatorUrl` explicitly to use a standalone service. The package is built from source and is not published to the npm registry by this project.

<p align="center">
  <img src="public/oracell-logo.png" alt="Oracell" width="112" height="112" />
</p>

<h1 align="center">Oracell</h1>

<p align="center"><strong>Fresh data. Clear conviction.</strong></p>

<p align="center">Market data and developer guides for applications built on Nervos CKB.</p>

<p align="center">
  <a href="#getting-started">Getting started</a> ·
  <a href="#pages">Pages</a> ·
  <a href="#development">Development</a>
</p>

## Overview

Oracell brings market exploration and CKB integration documentation into one focused interface. Built with Next.js, React, and TypeScript, the frontend combines a responsive market explorer with searchable developer guides.

## Pages

| Page | Route | Features |
| --- | --- | --- |
| Landing | `/` | Product introduction, floating jade artwork, and links to the explorer and documentation. |
| Market Data | `/markets` | CKB/USDT, BTC/USDT, ETH/USDT, and SOL/USDT; signed feed snapshots, source counts, CKB anchors, search, filters, and sorting. |
| Build Documentation | `/docs` | Integration guides, section navigation, documentation search, source viewing, and copy controls. |

The interface includes keyboard navigation, visible focus states, an expandable desktop icon rail, mobile sidebar drawers, and a horizontally scrollable market table. The hero animation respects reduced-motion preferences.

## Getting started

### Requirements

- Node.js 22.18 or later
- npm

### Local development

```sh
git clone https://github.com/rikokurnia/oracell.git
cd oracell
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). To serve signed quotes from Next.js, set the server-only `ORACELL_PUBLISHER_PRIVATE_KEY` to a valid 32-byte hex key. Use `NEXT_PUBLIC_ORACELL_AGGREGATOR_URL=http://localhost:4001` in `.env.local` to use the standalone aggregator instead.

### Production

```sh
npm run build
npm start
```

## Development

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server. |
| `npm run lint` | Run ESLint. |
| `npm test` | Check feed decoding, precision, malformed responses, and hosted fallback behavior. |
| `npm run typecheck` | Generate Next.js route types and check TypeScript. |
| `npm run build` | Build the application for production. |
| `npm start` | Serve the production build. |

### Project structure

```text
app/          Application routes, metadata, and shared styles
components/   Navigation, branding, and responsive page shell
lib/          Market data, documentation content, and logo sources
public/       Oracell artwork and asset logos
artifacts/    Desktop and mobile captures with visual comparisons
```

## Data and assets

The frontend polls the same-origin `/api/oracle/feeds` every 15 seconds by default. The Vercel function signs on demand using REST price snapshots and a CKB tip header. It requires the server-only `ORACELL_PUBLISHER_PRIVATE_KEY` in Vercel. An explicit `NEXT_PUBLIC_ORACELL_AGGREGATOR_URL` switches the explorer to the standalone service at `/v1/oracle/feeds`, which also offers streaming. Connection interruptions preserve the last received snapshot with a notice. Neither snapshot endpoint supplies historical returns.

Documentation in `lib/docs.ts` follows the implementation in `packages/sdk/` and `contracts/`. The frontend does not verify Schnorr signatures or submit transactions; consuming applications should use a trusted publisher key with the SDK and their deployed CKB verifier. Backend, SDK, and contract builds are separate from the Next.js frontend build.

Asset logos are sourced from the CoinGecko API and cached in `public/markets/`. Original API and image URLs are recorded in [`lib/asset-logo-sources.json`](lib/asset-logo-sources.json). Asset names and logos belong to their respective owners.

Oracell branding and transparent artwork are stored in `public/`. The Open O mark is used throughout navigation and as the favicon.

## Visual verification

The [`artifacts/`](artifacts/) directory includes captures at desktop (1672 × 941) and mobile (390 × 844) sizes. Laptop captures at 1280 × 640 show the compact interface at normal zoom, including both the icon rail and expanded sidebar. The comparison images preserve the original reference comparison.

Browser verification covers navigation, market search and filters, price sorting, empty results, sidebar behavior, documentation anchors, clipboard actions, and responsive layouts.

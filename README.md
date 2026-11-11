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
| Market Data | `/markets` | CKB/USD, BTC/USD, ETH/USD, and USDT/USD; search, asset filters, sortable prices, and seven-day trend charts. |
| Build Documentation | `/docs` | Integration guides, section navigation, documentation search, source viewing, and copy controls. |

The interface includes keyboard navigation, visible focus states, mobile sidebar drawers, and a horizontally scrollable market table. The hero animation respects reduced-motion preferences.

## Getting started

### Requirements

- Node.js 22 or later
- npm

### Local development

```sh
git clone https://github.com/rikokurnia/oracell.git
cd oracell
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). No environment variables or API keys are required.

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

Market prices and trend data are defined in `lib/markets.ts`. Documentation content lives in `lib/docs.ts`. This repository contains the frontend; live price delivery, wallet connections, on-chain verification, and an executable SDK are separate integrations.

Asset logos are sourced from the CoinGecko API and cached in `public/markets/`. Original API and image URLs are recorded in [`lib/asset-logo-sources.json`](lib/asset-logo-sources.json). Asset names and logos belong to their respective owners.

Oracell branding and transparent artwork are stored in `public/`. The Open O mark is used throughout navigation and as the favicon.

## Visual verification

The [`artifacts/`](artifacts/) directory includes captures at desktop (1672 × 941) and mobile (390 × 844) sizes. Comparison images place the reference on the left and the implementation on the right.

Browser verification covers navigation, market search and filters, price sorting, empty results, sidebar behavior, documentation anchors, clipboard actions, and responsive layouts.

import assetLogos from "./asset-logo-sources.json" with { type: "json" };

export const AGGREGATOR_URL = (
  process.env.NEXT_PUBLIC_ORACELL_AGGREGATOR_URL?.trim() ||
  "http://localhost:4001"
).replace(/\/+$/, "");
export const POLL_INTERVAL_MS = 5_000;
export const STALE_AFTER_MS = 30_000;

export const marketCatalog = [
  {
    name: "Nervos",
    symbol: "CKB/USDT",
    pairKey: "CKB_USDT",
    logo: assetLogos.ckb.path,
  },
  {
    name: "Bitcoin",
    symbol: "BTC/USDT",
    pairKey: "BTC_USDT",
    logo: assetLogos.btc.path,
  },
  {
    name: "Ethereum",
    symbol: "ETH/USDT",
    pairKey: "ETH_USDT",
    logo: assetLogos.eth.path,
  },
  {
    name: "Solana",
    symbol: "SOL/USDT",
    pairKey: "SOL_USDT",
    logo: "/markets/sol.png",
  },
] as const;
export type PairSymbol = (typeof marketCatalog)[number]["symbol"];
export type SignedFeed = {
  pair: PairSymbol;
  pairKey: string;
  payload: {
    magic: "ORCL";
    version: 1;
    pair: PairSymbol;
    priceScaled: string;
    decimals: 8;
    price: number;
    timestampMs: number;
    blockNumber: number;
    tipBlockHash: string;
    blockTimestampMs: number;
    sourceCount: number;
    flags: number;
  };
  payloadHex: string;
  digestHex: string;
  pubkey: string;
  signature: string;
  witnessHex: string;
};
export type Market = (typeof marketCatalog)[number] & {
  feed: SignedFeed | null;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
function integer(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function hex(value: unknown, bytes: number): value is string {
  return (
    typeof value === "string" &&
    new RegExp(`^0x[0-9a-fA-F]{${bytes * 2}}$`).test(value)
  );
}

/** Validate the HTTP boundary; signature verification belongs to the SDK/verifier. */
export function parseFeedsResponse(value: unknown): SignedFeed[] {
  if (
    !record(value) ||
    value.version !== 1 ||
    !Array.isArray(value.feeds) ||
    !hex(value.publisherPubkey, 32)
  )
    throw new Error("Invalid feed response");
  const seen = new Set<string>();
  return value.feeds.flatMap((item: unknown) => {
    if (!record(item)) throw new Error("Invalid signed feed");
    const catalog = marketCatalog.find((m) => m.symbol === item.pair);
    if (!catalog) return [];
    const p = item.payload;
    if (
      !record(p) ||
      p.magic !== "ORCL" ||
      p.version !== 1 ||
      p.pair !== item.pair ||
      p.decimals !== 8 ||
      typeof p.priceScaled !== "string" ||
      !/^\d{1,20}$/.test(p.priceScaled) ||
      BigInt(p.priceScaled) > BigInt("18446744073709551615") ||
      typeof p.price !== "number" ||
      !Number.isFinite(p.price) ||
      p.price < 0 ||
      !integer(p.timestampMs) ||
      p.timestampMs > 8_640_000_000_000_000 ||
      !integer(p.blockNumber) ||
      !integer(p.blockTimestampMs) ||
      !integer(p.sourceCount) ||
      p.sourceCount > 255 ||
      !integer(p.flags) ||
      p.flags > 255 ||
      !hex(p.tipBlockHash, 32) ||
      !hex(item.payloadHex, 88) ||
      !hex(item.digestHex, 32) ||
      !hex(item.pubkey, 32) ||
      !hex(item.signature, 64) ||
      !hex(item.witnessHex, 184) ||
      item.pairKey !== catalog.pairKey ||
      item.pubkey.toLowerCase() !==
        (value.publisherPubkey as string).toLowerCase() ||
      seen.has(catalog.symbol)
    )
      throw new Error("Invalid signed feed");
    seen.add(catalog.symbol);
    return [item as SignedFeed];
  });
}

/** Keep the decimal string precise instead of round-tripping it through a float. */
export function formatPrice(priceScaled: string, decimals = 8): string {
  const digits = priceScaled.padStart(decimals + 1, "0");
  const whole = digits
    .slice(0, -decimals)
    .replace(/^0+(?=\d)/, "")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = digits.slice(-decimals).replace(/0+$/, "").padEnd(2, "0");
  return `${whole}.${fraction}`;
}
export function getMarkets(feeds: SignedFeed[]): Market[] {
  return marketCatalog.map((m) => ({
    ...m,
    feed: feeds.find((f) => f.pair === m.symbol) ?? null,
  }));
}
export function feedAge(timestamp: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  return seconds < 60
    ? `${seconds}s ago`
    : seconds < 3600
      ? `${Math.floor(seconds / 60)}m ago`
      : `${Math.floor(seconds / 3600)}h ago`;
}

/** Hosted previews without configuration must not access a visitor's localhost. */
export function canConnectToAggregator(page: {
  hostname: string;
  protocol: string;
}): boolean {
  try {
    const url = new URL(AGGREGATOR_URL);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    if (page.protocol === "https:" && url.protocol !== "https:") return false;
    const loopback = ["localhost", "127.0.0.1", "[::1]"];
    if (loopback.includes(url.hostname) && !loopback.includes(page.hostname))
      return false;
    return true;
  } catch {
    return false;
  }
}

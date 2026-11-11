import assetLogos from "./asset-logo-sources.json";

export type Market = {
  name: string;
  symbol: string;
  type: "Crypto" | "Stablecoin";
  price: number;
  displayPrice: string;
  change: number;
  feed: string;
  logo: string;
  trend: number[];
};
export const markets: Market[] = [
  {
    name: "Nervos",
    symbol: "CKB/USD",
    type: "Crypto",
    price: 0.004812,
    displayPrice: "0.004812",
    change: 2.34,
    feed: "0x8c42…a91f",
    logo: assetLogos.ckb.path,
    trend: [
      32, 34, 30, 31, 27, 29, 25, 26, 24, 27, 23, 19, 22, 18, 19, 15, 12, 13, 9,
      7, 2,
    ],
  },
  {
    name: "Bitcoin",
    symbol: "BTC/USD",
    type: "Crypto",
    price: 104286.5,
    displayPrice: "104,286.50",
    change: 1.12,
    feed: "0xe62d…9c4a",
    logo: assetLogos.btc.path,
    trend: [
      35, 36, 32, 33, 29, 30, 25, 28, 24, 27, 23, 19, 24, 22, 17, 19, 17, 15,
      16, 10, 11, 5,
    ],
  },
  {
    name: "Ethereum",
    symbol: "ETH/USD",
    type: "Crypto",
    price: 3842.16,
    displayPrice: "3,842.16",
    change: -0.86,
    feed: "0xff61…d0b8",
    logo: assetLogos.eth.path,
    trend: [
      5, 7, 3, 8, 9, 13, 12, 17, 13, 14, 21, 18, 22, 20, 25, 22, 29, 27, 31, 30,
      35,
    ],
  },
  {
    name: "Tether",
    symbol: "USDT/USD",
    type: "Stablecoin",
    price: 1.0001,
    displayPrice: "1.0001",
    change: 0.01,
    feed: "0x2b89…6f3e",
    logo: assetLogos.usdt.path,
    trend: [
      20, 21, 20, 20, 19, 20, 19, 20, 21, 20, 20, 22, 20, 21, 20, 21, 20, 21,
      20, 21,
    ],
  },
];

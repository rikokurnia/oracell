# Oracell Phase 1 Aggregator — Frontend & SDK Integration Notes

## Service Overview
- **Default Base URL:** `http://localhost:4001` (override via `PORT`)
- **CORS:** Enabled (`Access-Control-Allow-Origin: *`, `GET, OPTIONS`)
- **Supported Pairs:** `CKB/USDT`, `BTC/USDT`, `ETH/USDT`, `SOL/USDT`
- **Data Pipeline:**
  - Tier 1 WebSocket + REST: **Binance** & **OKX**
  - Tier 2 Fallback & Circuit Breaker: **CoinGecko** REST fallback when Tier 1 has `< 2` quotes for a pair (e.g. OKX `CKB-USDT` unavailable) or when Tier 1 spread exceeds **`2.0%`**; outliers diverging `> 2.0%` from the 3-source median are scrubbed.
  - Tier 3 On-Chain Anchor: **CKB Testnet RPC** (`https://testnet.ckbapp.dev/`, `get_tip_header`)
- **Cryptographic Signature:** BIP-340 Schnorr / secp256k1 (MuSig2/FROST-compatible 64-byte signature over `sha256(payloadBytes)` with 32-byte x-only pubkey).
- **Default Testnet Publisher Pubkey:** `0x00bdfabb55b8dfab4d9211aabe3dd4afc83df9bded9dbab90eec8d9aeef40636`

---

## HTTP & SSE Endpoints

### 1. `GET /health`
Returns service health, publisher pubkey, active pairs, and latest CKB tip header.
```json
{
  "status": "ok",
  "service": "oracell-aggregator",
  "version": "0.1.0",
  "port": 4001,
  "uptimeMs": 12450,
  "publisherPubkey": "0x00bdfabb55b8dfab4d9211aabe3dd4afc83df9bded9dbab90eec8d9aeef40636",
  "ckbRpcUrl": "https://testnet.ckbapp.dev/",
  "ckbTip": {
    "tipBlockHash": "0x2744652538156731685b79f596bc828099ca7280fc50de9f5db4b8c47da80118",
    "blockNumber": 23099353,
    "blockTimestampMs": 1794966398000,
    "epoch": "0x70806a5003782",
    "fetchedAtMs": 1794966400000
  },
  "pairCount": 4,
  "activePairs": ["CKB/USDT", "BTC/USDT", "ETH/USDT", "SOL/USDT"],
  "lastUpdatedMs": 1794966400500
}
```

### 2. `GET /v1/oracle/feeds`
Returns all latest signed feeds.
```json
{
  "version": 1,
  "publisherPubkey": "0x00bdfabb55b8dfab4d9211aabe3dd4afc83df9bded9dbab90eec8d9aeef40636",
  "ckbTip": { "...": "..." },
  "updatedAtMs": 1794966400500,
  "feeds": [ /* array of SignedOracleFeed */ ]
}
```

### 3. `GET /v1/oracle/quote?pair=CKB_USDT`
Returns a single `SignedOracleFeed` ready for Witness injection via `@oracell/sdk`.
Accepts `pair` formatted as `CKB_USDT`, `CKB-USDT`, or `CKB/USDT`.

```json
{
  "pair": "CKB/USDT",
  "pairKey": "CKB_USDT",
  "payload": {
    "magic": "ORCL",
    "version": 1,
    "pair": "CKB/USDT",
    "priceScaled": "89900",
    "decimals": 8,
    "price": 0.000899,
    "timestampMs": 1794966400000,
    "blockNumber": 23099353,
    "tipBlockHash": "0x2744652538156731685b79f596bc828099ca7280fc50de9f5db4b8c47da80118",
    "blockTimestampMs": 1794966398000,
    "sourceCount": 2,
    "flags": 1
  },
  "payloadHex": "0x...",
  "digestHex": "0x...",
  "pubkey": "0x00bdfabb55b8dfab4d9211aabe3dd4afc83df9bded9dbab90eec8d9aeef40636",
  "signature": "0x...",
  "witnessHex": "0x...",
  "sources": [
    { "source": "binance", "pair": "CKB/USDT", "price": 0.000899, "timestampMs": 1794966400000 },
    { "source": "coingecko", "pair": "CKB/USDT", "price": 0.000899, "timestampMs": 1794966400000 }
  ],
  "circuitBreaker": {
    "thresholdPercent": 2,
    "triggered": true,
    "tripped": false,
    "fallbackUsed": true,
    "maxDeviationPercent": 0,
    "scrubbedSources": [],
    "reason": "Tier 1 single-source fallback engaged (CoinGecko)"
  }
}
```

### 4. `GET /v1/oracle/stream` (Server-Sent Events)
Emits an immediate `feeds` snapshot upon connection and pushes updates on each aggregation cycle (~1.5s), with `: keepalive` comments every 15s:
```
event: feeds
data: {"timestampMs":1794966400500,"feeds":[ ...SignedOracleFeed[] ]}
```

---

## Canonical 184-Byte CKB Witness Binary Layout (`witnessHex`)
Verified identically by `contracts/oracell-verifier` (CKB-VM RISC-V) and `@oracell/sdk`:

| Offset | Size | Field | Encoding |
| :--- | :--- | :--- | :--- |
| `0..4` | 4B | `magic` | ASCII `"ORCL"` (`0x4f52434c`) |
| `4..5` | 1B | `version` | `u8` (`1`) |
| `5..21` | 16B | `pair` | UTF-8 ASCII null-padded (e.g. `"CKB/USDT"`) |
| `21..29` | 8B | `priceScaled` | `u64` little-endian (`price * 10^8`) |
| `29..30` | 1B | `decimals` | `u8` (`8`) |
| `30..38` | 8B | `timestampMs` | `u64` little-endian |
| `38..46` | 8B | `blockNumber` | `u64` little-endian |
| `46..78` | 32B | `tipBlockHash` | raw 32-byte CKB block hash |
| `78..86` | 8B | `blockTimestampMs` | `u64` little-endian |
| `86..87` | 1B | `sourceCount` | `u8` |
| `87..88` | 1B | `flags` | `u8` (bit 0: CoinGecko fallback, bit 1: CB tripped) |
| `88..120` | 32B | `pubkey` | 32-byte x-only BIP-340 Schnorr pubkey |
| `120..184` | 64B | `signature` | 64-byte Schnorr signature over `sha256(payload[0..88])` |

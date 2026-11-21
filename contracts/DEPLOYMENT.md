# Pudge verifier deployment

Network is Nervos CKB Testnet (Pudge). Both transactions were confirmed via the Pudge RPC on 21 November 2026.

- Code cell deployment transaction: `0xb2834f4487155d69fa5780a40819196cca1f818a3e62175bb9f2f39a7aeac0b1`
- Deployment block: 23,135,440
- Deployment block hash: `0x0a1ee5ef02f515ed3c8c73170b5c14d45e6257b17a7be7a0c61237c2c433d3b6`
- Output index: `0x0`
- Code hash: `0x800ffb8713e4ae7d7224a8aad942f73c0668f1092e2054cd71bd7f716b7f0e5c`
- Hash type: `data2`
- Cell dependency type: `code`
- Binary: 102,616 bytes of RISC-V ELF
- Occupied code cell capacity: 102,677 testnet CKB

## Confirmed consuming transaction

- Transaction: [0x14beb0d8…ee90](https://pudge.explorer.nervos.org/transaction/0x14beb0d8c0bc0b2a2f1c4aa788c3171284b4c5443074a28059e234cc5bf0ee90)
- Confirmation block: 23,135,450
- Confirmation block hash: `0x995638219a95d2d7218d74798eb2dc1077642615e50dffb4ab9c446d532e67b8`
- Quote: CKB/USDT at 0.00078220 USDT (`priceScaled = 78220`, 8 decimals)
- Signed anchor and reference tip at submission: 23,135,447
- Signed anchor hash: `0x60cb843a75d827f23e065bd55c0847aa29d5ad50f5ab281d30f30333d2c5b48b`
- Publisher public key: `0x2b8dd40f7963d35f87d978a00ee6f62b185280dd79e95d49ca636083c3ae63dd`
- Consumer output index: `0x0`, using the code cell above as a code dependency.
- RPC estimate for the signed transaction: 5,530,230 cycles. This includes the lock and is separate from the emulator benchmark.

The SDK fetched the quote from `https://oracell.vercel.app`, verified BIP-340 against the pinned publisher key, and inserted a 184-byte proof in `WitnessArgs.output_type` before the funding lock signed the transaction. The network included it three blocks after the signed anchor. The two-block verifier rule is relative to supplied dependencies, so this inclusion is consistent with the documented behavior.

[Deployment transaction on Pudge](https://pudge.explorer.nervos.org/transaction/0xb2834f4487155d69fa5780a40819196cca1f818a3e62175bb9f2f39a7aeac0b1)

## Reproduce with a funded Pudge wallet

```sh
npm --prefix packages/sdk ci
bash contracts/scripts/build.sh
export ORACELL_PUDGE_WALLET_KEY_FILE=/path/to/private/testnet-wallet-key
export ORACELL_PUBLISHER_PUBKEY=0x2b8dd40f7963d35f87d978a00ee6f62b185280dd79e95d49ca636083c3ae63dd
npm --prefix packages/sdk exec -- tsx packages/sdk/examples/pudge-proof.ts prove 0xb2834f4487155d69fa5780a40819196cca1f818a3e62175bb9f2f39a7aeac0b1
```

Run from the repository root. The runner also supports `balance`, `deploy <binary>` and `confirm <tx-hash>`. Deployment locks 102,677 testnet CKB in the current binary's code cell, plus transaction fees. Reusing the existing code cell only requires the proof transaction's own inputs and fees.

## Freshness and publisher scope

The verifier checks the signed anchor against the transaction header dependencies and allows up to two blocks of lag from the highest supplied header. This comparison cannot establish freshness against the independent network tip. The proof runner verifies the signature against a pinned public key, compares the quote with the public RPC tip and canonical header, and adds the RPC tip as a reference dependency before signing. Those client-side checks provide submission-time evidence, subject to tip movement before inclusion.

Phase 1 uses a single BIP-340 publisher. Distributed key generation and threshold signing are Phase 3 work.

## Reproduce the local measurements

Run `bash contracts/scripts/build.sh` and then
`cargo test --manifest-path contracts/Cargo.toml --locked --workspace -- --nocapture`.
The `ORACELL_BENCHMARK` line reproduces the numbers in `contracts/benchmark.json`. The result measures emulator validation and a modeled shared-input admission rule.

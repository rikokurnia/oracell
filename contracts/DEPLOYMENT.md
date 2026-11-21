# Pudge verifier deployment

Network is Nervos CKB Testnet (Pudge). The verifier deployment transaction was broadcast and is awaiting confirmation.

- Code cell deployment transaction: `0xb2834f4487155d69fa5780a40819196cca1f818a3e62175bb9f2f39a7aeac0b1`
- Output index: `0x0`
- Code hash: `0x800ffb8713e4ae7d7224a8aad942f73c0668f1092e2054cd71bd7f716b7f0e5c`
- Hash type: `data2`
- Cell dependency type: `code`
- Binary: 102,616 bytes of RISC-V ELF
- Occupied code cell capacity: 102,677 testnet CKB

## Freshness and publisher scope

The verifier checks the signed anchor against the transaction header dependencies and allows up to two blocks of lag from the highest supplied header. This comparison cannot establish freshness against the independent network tip. The proof runner verifies the signature against a pinned public key, compares the quote with the public RPC tip and canonical header, and adds the RPC tip as a reference dependency before signing. Those client-side checks provide submission-time evidence, subject to tip movement before inclusion.

Phase 1 uses a single BIP-340 publisher. Distributed key generation and threshold signing are Phase 3 work.

## Reproduce the local measurements

Run `bash contracts/scripts/build.sh` and then
`cargo test --manifest-path contracts/Cargo.toml --locked --workspace -- --nocapture`.
The `ORACELL_BENCHMARK` line reproduces the numbers in `contracts/benchmark.json`. The result measures emulator validation and a modeled shared-input admission rule.

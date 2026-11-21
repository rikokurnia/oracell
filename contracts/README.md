# Oracell CKB-VM Contracts (`contracts/`)

Stateless Witness Verifier Type Script for Nervos CKB (`riscv64imac-unknown-none-elf`).

## Workspace Crates
- `oracell-core`: Pure `no_std` Rust parsing, BIP-340 Schnorr signature verification (`k256` + `sha2`), and Tip-Header Binding (`header_deps` + monotonic freshness window).
- `oracell-verifier`: CKB-VM RISC-V Type Script binary using `ckb-std` (`build-with-clang`).
- `tests`: Host unit tests + full CKB-VM RISC-V emulator integration tests using `ckb-testtool`.

## Build & Test
```bash
./scripts/build.sh
./scripts/test.sh
```

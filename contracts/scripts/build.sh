#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
cargo build --release -p oracell-verifier --target riscv64imac-unknown-none-elf
echo "Built RISC-V verifier binary: target/riscv64imac-unknown-none-elf/release/oracell-verifier"
ls -lh target/riscv64imac-unknown-none-elf/release/oracell-verifier

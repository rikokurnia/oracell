#![cfg_attr(target_arch = "riscv64", no_std)]
#![cfg_attr(target_arch = "riscv64", no_main)]

#[cfg(target_arch = "riscv64")]
ckb_std::entry!(program_entry);
#[cfg(target_arch = "riscv64")]
ckb_std::default_alloc!();

#[cfg(target_arch = "riscv64")]
fn run_verifier() -> Result<(), oracell_core::VerifierError> {
    use alloc::vec::Vec;
    use ckb_std::{
        ckb_constants::Source,
        ckb_types::prelude::*,
        high_level::{load_header, load_script, load_transaction, QueryIter},
    };
    use oracell_core::{verify_oracle_proof, HeaderDepInfo, VerifierError};

    let script = load_script().map_err(|_| VerifierError::SysError)?;
    let script_args = script.args().raw_data();

    let tx = load_transaction().map_err(|_| VerifierError::SysError)?;
    let witnesses_packed = tx.witnesses();
    let mut witness_buffers: Vec<Vec<u8>> = Vec::with_capacity(witnesses_packed.len());
    for i in 0..witnesses_packed.len() {
        let item = witnesses_packed.get(i).ok_or(VerifierError::SysError)?;
        witness_buffers.push(item.raw_data().to_vec());
    }
    let witness_slices: Vec<&[u8]> = witness_buffers.iter().map(|b| b.as_slice()).collect();

    let header_deps: Vec<HeaderDepInfo> = QueryIter::new(load_header, Source::HeaderDep)
        .map(|hdr| {
            let mut hash = [0u8; 32];
            hash.copy_from_slice(hdr.calc_header_hash().as_slice());
            let number: u64 = hdr.raw().number().unpack();
            HeaderDepInfo { hash, number }
        })
        .collect();

    verify_oracle_proof(&script_args, &witness_slices, &header_deps)?;
    Ok(())
}

#[cfg(target_arch = "riscv64")]
pub fn program_entry() -> i8 {
    match run_verifier() {
        Ok(()) => 0,
        Err(err) => err.code(),
    }
}

#[cfg(not(target_arch = "riscv64"))]
fn main() {}

#![no_std]

use k256::schnorr::{Signature, VerifyingKey};
use sha2::{Digest, Sha256};

pub const PAYLOAD_SIZE: usize = 88;
pub const PUBKEY_SIZE: usize = 32;
pub const SIGNATURE_SIZE: usize = 64;
pub const WITNESS_SIZE: usize = PAYLOAD_SIZE + PUBKEY_SIZE + SIGNATURE_SIZE; // 184 bytes
pub const ORACELL_MAGIC: [u8; 4] = *b"ORCL";
pub const ORACELL_VERSION: u8 = 1;
pub const DEFAULT_MAX_BLOCK_LAG: u64 = 2;

#[repr(i8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VerifierError {
    InvalidScriptArgs = 1,
    WitnessNotFound = 2,
    InvalidWitnessFormat = 3,
    PubkeyMismatch = 4,
    InvalidSignature = 5,
    TipHeaderNotInDeps = 6,
    BlockNumberMismatch = 7,
    StaleOracleBlock = 8,
    SysError = 9,
}

impl VerifierError {
    pub fn code(self) -> i8 {
        self as i8
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedOraclePayload {
    pub version: u8,
    pub pair: [u8; 16],
    pub price_scaled: u64,
    pub decimals: u8,
    pub timestamp_ms: u64,
    pub block_number: u64,
    pub tip_block_hash: [u8; 32],
    pub block_timestamp_ms: u64,
    pub source_count: u8,
    pub flags: u8,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedOracleWitness<'a> {
    pub payload_bytes: &'a [u8; PAYLOAD_SIZE],
    pub payload: ParsedOraclePayload,
    pub pubkey: [u8; PUBKEY_SIZE],
    pub signature: [u8; SIGNATURE_SIZE],
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct HeaderDepInfo {
    pub hash: [u8; 32],
    pub number: u64,
}

pub fn parse_script_args(args: &[u8]) -> Result<([u8; 32], u64), VerifierError> {
    if args.len() != 32 && args.len() != 40 {
        return Err(VerifierError::InvalidScriptArgs);
    }
    let mut pubkey = [0u8; 32];
    pubkey.copy_from_slice(&args[0..32]);

    let max_lag = if args.len() == 40 {
        u64::from_le_bytes(args[32..40].try_into().map_err(|_| VerifierError::InvalidScriptArgs)?)
    } else {
        DEFAULT_MAX_BLOCK_LAG
    };

    Ok((pubkey, max_lag))
}

pub fn parse_oracle_payload(bytes: &[u8]) -> Result<ParsedOraclePayload, VerifierError> {
    if bytes.len() != PAYLOAD_SIZE {
        return Err(VerifierError::InvalidWitnessFormat);
    }
    if bytes[0..4] != ORACELL_MAGIC {
        return Err(VerifierError::InvalidWitnessFormat);
    }
    let version = bytes[4];
    if version != ORACELL_VERSION {
        return Err(VerifierError::InvalidWitnessFormat);
    }

    let mut pair = [0u8; 16];
    pair.copy_from_slice(&bytes[5..21]);

    let price_scaled = u64::from_le_bytes(bytes[21..29].try_into().unwrap());
    let decimals = bytes[29];
    let timestamp_ms = u64::from_le_bytes(bytes[30..38].try_into().unwrap());
    let block_number = u64::from_le_bytes(bytes[38..46].try_into().unwrap());

    let mut tip_block_hash = [0u8; 32];
    tip_block_hash.copy_from_slice(&bytes[46..78]);

    let block_timestamp_ms = u64::from_le_bytes(bytes[78..86].try_into().unwrap());
    let source_count = bytes[86];
    let flags = bytes[87];

    Ok(ParsedOraclePayload {
        version,
        pair,
        price_scaled,
        decimals,
        timestamp_ms,
        block_number,
        tip_block_hash,
        block_timestamp_ms,
        source_count,
        flags,
    })
}

pub fn parse_oracle_witness(bytes: &[u8]) -> Result<ParsedOracleWitness<'_>, VerifierError> {
    if bytes.len() != WITNESS_SIZE {
        return Err(VerifierError::InvalidWitnessFormat);
    }
    if bytes[0..4] != ORACELL_MAGIC {
        return Err(VerifierError::InvalidWitnessFormat);
    }

    let payload_bytes: &[u8; PAYLOAD_SIZE] = bytes[0..PAYLOAD_SIZE]
        .try_into()
        .map_err(|_| VerifierError::InvalidWitnessFormat)?;
    let payload = parse_oracle_payload(payload_bytes)?;

    let mut pubkey = [0u8; PUBKEY_SIZE];
    pubkey.copy_from_slice(&bytes[PAYLOAD_SIZE..PAYLOAD_SIZE + PUBKEY_SIZE]);

    let mut signature = [0u8; SIGNATURE_SIZE];
    signature.copy_from_slice(&bytes[PAYLOAD_SIZE + PUBKEY_SIZE..WITNESS_SIZE]);

    Ok(ParsedOracleWitness {
        payload_bytes,
        payload,
        pubkey,
        signature,
    })
}

/// Checks if `bytes` is a Molecule-encoded `WitnessArgs` and extracts `output_type` or `input_type`
/// if it contains an Oracell proof.
pub fn extract_oracle_from_witness_args(bytes: &[u8]) -> Option<&[u8]> {
    // Molecule Table with 3 fields has 4-byte total_size + 3 * 4-byte offsets = 16 bytes header.
    if bytes.len() < 16 {
        return None;
    }
    let total_size = u32::from_le_bytes(bytes[0..4].try_into().ok()?) as usize;
    if total_size != bytes.len() {
        return None;
    }
    let off0 = u32::from_le_bytes(bytes[4..8].try_into().ok()?) as usize;
    let off1 = u32::from_le_bytes(bytes[8..12].try_into().ok()?) as usize;
    let off2 = u32::from_le_bytes(bytes[12..16].try_into().ok()?) as usize;

    if off0 != 16 || off1 < off0 || off2 < off1 || off2 > total_size {
        return None;
    }

    // Check output_type (field 2) first, then input_type (field 1)
    for (start, end) in [(off2, total_size), (off1, off2)] {
        let field_slice = &bytes[start..end];
        if field_slice.len() >= 4 {
            let item_len = u32::from_le_bytes(field_slice[0..4].try_into().ok()?) as usize;
            if 4 + item_len == field_slice.len()
                && item_len == WITNESS_SIZE
                && field_slice[4..8] == ORACELL_MAGIC
            {
                return Some(&field_slice[4..4 + item_len]);
            }
        }
    }
    None
}

/// Searches a list of raw witness byte slices for a valid Oracell Witness
/// (either raw 184-byte `ORCL...` or wrapped inside `WitnessArgs.input_type` / `output_type`).
pub fn find_oracle_witness<'a>(witnesses: &[&'a [u8]]) -> Result<ParsedOracleWitness<'a>, VerifierError> {
    for &w in witnesses {
        if w.len() >= 4 && w[0..4] == ORACELL_MAGIC {
            return parse_oracle_witness(w);
        }
        if let Some(inner) = extract_oracle_from_witness_args(w) {
            return parse_oracle_witness(inner);
        }
    }

    Err(VerifierError::WitnessNotFound)
}

pub fn verify_schnorr_signature(
    witness: &ParsedOracleWitness<'_>,
    expected_pubkey: &[u8; 32],
) -> Result<(), VerifierError> {
    if &witness.pubkey != expected_pubkey {
        return Err(VerifierError::PubkeyMismatch);
    }

    let verifying_key =
        VerifyingKey::from_bytes(&witness.pubkey).map_err(|_| VerifierError::InvalidSignature)?;
    let sig =
        Signature::try_from(&witness.signature[..]).map_err(|_| VerifierError::InvalidSignature)?;

    let digest = Sha256::digest(witness.payload_bytes);
    verifying_key
        .verify_raw(&digest, &sig)
        .map_err(|_| VerifierError::InvalidSignature)
}

pub fn verify_tip_header_binding(
    payload: &ParsedOraclePayload,
    header_deps: &[HeaderDepInfo],
    max_block_lag: u64,
) -> Result<(), VerifierError> {
    if header_deps.is_empty() {
        return Err(VerifierError::TipHeaderNotInDeps);
    }

    let mut matched_tip = false;
    let mut max_header_number: u64 = 0;

    for hdr in header_deps {
        if hdr.number > max_header_number {
            max_header_number = hdr.number;
        }
        if hdr.hash == payload.tip_block_hash {
            if hdr.number != payload.block_number {
                return Err(VerifierError::BlockNumberMismatch);
            }
            matched_tip = true;
        }
    }

    if !matched_tip {
        return Err(VerifierError::TipHeaderNotInDeps);
    }

    if payload.block_number > max_header_number {
        return Err(VerifierError::StaleOracleBlock);
    }

    if max_header_number - payload.block_number > max_block_lag {
        return Err(VerifierError::StaleOracleBlock);
    }

    Ok(())
}

/// Complete stateless verification routine shared by CKB-VM and host unit tests.
pub fn verify_oracle_proof(
    script_args: &[u8],
    witnesses: &[&[u8]],
    header_deps: &[HeaderDepInfo],
) -> Result<ParsedOraclePayload, VerifierError> {
    let (expected_pubkey, max_lag) = parse_script_args(script_args)?;
    let parsed_witness = find_oracle_witness(witnesses)?;
    verify_schnorr_signature(&parsed_witness, &expected_pubkey)?;
    verify_tip_header_binding(&parsed_witness.payload, header_deps, max_lag)?;
    Ok(parsed_witness.payload)
}

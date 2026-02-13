use solana_program::{
    account_info::{next_account_info, AccountInfo},
    clock::Clock,
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program::invoke_signed,
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    system_instruction,
    sysvar::Sysvar,
};

entrypoint!(process_instruction);

// sha256("global:enable_rebalance")[0..8]
const IX_ENABLE: [u8; 8] = [94, 247, 51, 161, 142, 177, 235, 11];
// sha256("global:disable_rebalance")[0..8]
const IX_DISABLE: [u8; 8] = [170, 206, 89, 64, 74, 71, 94, 214];

// Account discriminator = sha256("account:RebalanceConfig")[0..8]
// We use the Anchor convention: sha256("account:RebalanceConfig")
// sha256("account:RebalanceConfig")[0..8]
const ACCOUNT_DISC: [u8; 8] = [111, 187, 136, 118, 41, 244, 175, 141];

const ACCOUNT_SIZE: usize = 8 + 32 + 1 + 2 + 2 + 8 + 8; // 61 bytes
const SEED: &[u8] = b"rebalance";

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    if instruction_data.len() < 8 {
        return Err(ProgramError::InvalidInstructionData);
    }

    let disc = &instruction_data[..8];

    if disc == IX_ENABLE {
        process_enable(program_id, accounts, &instruction_data[8..])
    } else if disc == IX_DISABLE {
        process_disable(program_id, accounts)
    } else {
        Err(ProgramError::InvalidInstructionData)
    }
}

fn process_enable(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    // Frontend sends: [owner, pda, system_program]
    let iter = &mut accounts.iter();
    let owner = next_account_info(iter)?;
    let config_account = next_account_info(iter)?;
    let system_program = next_account_info(iter)?;

    if !owner.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    if data.len() < 4 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let max_slippage_bps = u16::from_le_bytes([data[0], data[1]]);
    let min_yield_bps = u16::from_le_bytes([data[2], data[3]]);

    // Derive PDA
    let (expected_pda, bump) = Pubkey::find_program_address(
        &[SEED, owner.key.as_ref()],
        program_id,
    );
    if *config_account.key != expected_pda {
        msg!("Invalid PDA");
        return Err(ProgramError::InvalidSeeds);
    }

    let signer_seeds: &[&[u8]] = &[SEED, owner.key.as_ref(), &[bump]];

    let clock = Clock::get()?;
    let now = clock.unix_timestamp;

    // If account doesn't exist yet, create it
    if config_account.data_is_empty() {
        let rent = Rent::get()?;
        let lamports = rent.minimum_balance(ACCOUNT_SIZE);

        invoke_signed(
            &system_instruction::create_account(
                owner.key,
                config_account.key,
                lamports,
                ACCOUNT_SIZE as u64,
                program_id,
            ),
            &[owner.clone(), config_account.clone(), system_program.clone()],
            &[signer_seeds],
        )?;

        // Write fresh account
        let mut account_data = config_account.try_borrow_mut_data()?;
        write_config(
            &mut account_data,
            owner.key,
            true,
            max_slippage_bps,
            min_yield_bps,
            now,
            now,
        );
    } else {
        // Account exists — verify owner matches
        let account_data = config_account.try_borrow_data()?;
        let stored_owner = Pubkey::try_from(&account_data[8..40])
            .map_err(|_| ProgramError::InvalidAccountData)?;
        if stored_owner != *owner.key {
            return Err(ProgramError::IllegalOwner);
        }
        let created_at = i64::from_le_bytes(account_data[45..53].try_into().unwrap());
        drop(account_data);

        let mut account_data = config_account.try_borrow_mut_data()?;
        write_config(
            &mut account_data,
            owner.key,
            true,
            max_slippage_bps,
            min_yield_bps,
            created_at,
            now,
        );
    }

    msg!("Rebalance enabled for {}", owner.key);
    Ok(())
}

fn process_disable(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    // Frontend sends: [owner, pda]
    let iter = &mut accounts.iter();
    let owner = next_account_info(iter)?;
    let config_account = next_account_info(iter)?;

    if !owner.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Verify PDA
    let (expected_pda, _bump) = Pubkey::find_program_address(
        &[SEED, owner.key.as_ref()],
        program_id,
    );
    if *config_account.key != expected_pda {
        return Err(ProgramError::InvalidSeeds);
    }

    // Verify owner
    let account_data = config_account.try_borrow_data()?;
    if account_data.len() < ACCOUNT_SIZE {
        return Err(ProgramError::InvalidAccountData);
    }
    let stored_owner = Pubkey::try_from(&account_data[8..40])
        .map_err(|_| ProgramError::InvalidAccountData)?;
    if stored_owner != *owner.key {
        return Err(ProgramError::IllegalOwner);
    }
    drop(account_data);

    // Close the account (transfer lamports back to owner, zero data)
    let dest_lamports = owner.lamports();
    let source_lamports = config_account.lamports();
    **owner.try_borrow_mut_lamports()? = dest_lamports
        .checked_add(source_lamports)
        .ok_or(ProgramError::ArithmeticOverflow)?;
    **config_account.try_borrow_mut_lamports()? = 0;

    let mut data = config_account.try_borrow_mut_data()?;
    for byte in data.iter_mut() {
        *byte = 0;
    }

    msg!("Rebalance disabled for {}", owner.key);
    Ok(())
}

fn write_config(
    data: &mut [u8],
    owner: &Pubkey,
    enabled: bool,
    max_slippage_bps: u16,
    min_yield_bps: u16,
    created_at: i64,
    updated_at: i64,
) {
    // 8-byte discriminator (zeros for now — we'll set the real one)
    data[..8].copy_from_slice(&ACCOUNT_DISC);
    data[8..40].copy_from_slice(owner.as_ref());
    data[40] = if enabled { 1 } else { 0 };
    data[41..43].copy_from_slice(&max_slippage_bps.to_le_bytes());
    data[43..45].copy_from_slice(&min_yield_bps.to_le_bytes());
    data[45..53].copy_from_slice(&created_at.to_le_bytes());
    data[53..61].copy_from_slice(&updated_at.to_le_bytes());
}

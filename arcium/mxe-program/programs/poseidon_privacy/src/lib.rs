use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;

const COMP_DEF_OFFSET_ENCRYPTED_DEPOSIT: u32 = comp_def_offset("encrypted_deposit");
const COMP_DEF_OFFSET_ENCRYPTED_REBALANCE: u32 = comp_def_offset("encrypted_rebalance");
const COMP_DEF_OFFSET_VIEW_POSITION: u32 = comp_def_offset("view_position");

declare_id!("CqPbSB5EhenJenf6k2jKAZepeS4MoMghkEv6HpRUQFf9");

#[arcium_program]
pub mod poseidon_privacy {
    use super::*;

    // ============================================================
    // Computation Definition Initialization (called once per instruction)
    // ============================================================

    pub fn init_encrypted_deposit_comp_def(
        ctx: Context<InitEncryptedDepositCompDef>,
    ) -> Result<()> {
        init_comp_def(ctx.accounts, None, None)?;
        Ok(())
    }

    pub fn init_encrypted_rebalance_comp_def(
        ctx: Context<InitEncryptedRebalanceCompDef>,
    ) -> Result<()> {
        init_comp_def(ctx.accounts, None, None)?;
        Ok(())
    }

    pub fn init_view_position_comp_def(
        ctx: Context<InitViewPositionCompDef>,
    ) -> Result<()> {
        init_comp_def(ctx.accounts, None, None)?;
        Ok(())
    }

    // ============================================================
    // Queue Computation Instructions
    // ============================================================

    pub fn encrypted_deposit(
        ctx: Context<EncryptedDeposit>,
        computation_offset: u64,
        ct_amount: [u8; 32],
        ct_price_lower: [u8; 32],
        ct_price_upper: [u8; 32],
        pub_key: [u8; 32],
        nonce: u128,
    ) -> Result<()> {
        let args = ArgBuilder::new()
            .x25519_pubkey(pub_key)
            .plaintext_u128(nonce)
            .encrypted_u64(ct_amount)
            .encrypted_u64(ct_price_lower)
            .encrypted_u64(ct_price_upper)
            .build();

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            vec![EncryptedDepositCallback::callback_ix(
                computation_offset,
                &ctx.accounts.mxe_account,
                &[],
            )?],
            1,
            0,
        )?;
        Ok(())
    }

    pub fn encrypted_rebalance(
        ctx: Context<EncryptedRebalance>,
        computation_offset: u64,
        ct_amount_a: [u8; 32],
        ct_amount_b: [u8; 32],
        ct_new_price_lower: [u8; 32],
        ct_new_price_upper: [u8; 32],
        pub_key: [u8; 32],
        nonce: u128,
    ) -> Result<()> {
        let args = ArgBuilder::new()
            .x25519_pubkey(pub_key)
            .plaintext_u128(nonce)
            .encrypted_u64(ct_amount_a)
            .encrypted_u64(ct_amount_b)
            .encrypted_u64(ct_new_price_lower)
            .encrypted_u64(ct_new_price_upper)
            .build();

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            vec![EncryptedRebalanceCallback::callback_ix(
                computation_offset,
                &ctx.accounts.mxe_account,
                &[],
            )?],
            1,
            0,
        )?;
        Ok(())
    }

    pub fn view_position(
        ctx: Context<ViewPosition>,
        computation_offset: u64,
        ct_amount: [u8; 32],
        ct_price_lower: [u8; 32],
        ct_price_upper: [u8; 32],
        pub_key: [u8; 32],
        nonce: u128,
    ) -> Result<()> {
        let args = ArgBuilder::new()
            .x25519_pubkey(pub_key)
            .plaintext_u128(nonce)
            .encrypted_u64(ct_amount)
            .encrypted_u64(ct_price_lower)
            .encrypted_u64(ct_price_upper)
            .build();

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;

        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            vec![ViewPositionCallback::callback_ix(
                computation_offset,
                &ctx.accounts.mxe_account,
                &[],
            )?],
            1,
            0,
        )?;
        Ok(())
    }

    // ============================================================
    // Callbacks
    // ============================================================

    #[arcium_callback(encrypted_ix = "encrypted_deposit")]
    pub fn encrypted_deposit_callback(
        ctx: Context<EncryptedDepositCallback>,
        output: SignedComputationOutputs<EncryptedDepositOutput>,
    ) -> Result<()> {
        let o = match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account,
        ) {
            Ok(EncryptedDepositOutput { field_0 }) => field_0,
            Err(_) => return Err(ErrorCode::AbortedComputation.into()),
        };

        emit!(DepositEvent {
            encrypted_amount: o.ciphertexts[0],
            encrypted_price_lower: o.ciphertexts[1],
            encrypted_price_upper: o.ciphertexts[2],
            nonce: o.nonce.to_le_bytes(),
        });
        Ok(())
    }

    #[arcium_callback(encrypted_ix = "encrypted_rebalance")]
    pub fn encrypted_rebalance_callback(
        ctx: Context<EncryptedRebalanceCallback>,
        output: SignedComputationOutputs<EncryptedRebalanceOutput>,
    ) -> Result<()> {
        let o = match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account,
        ) {
            Ok(EncryptedRebalanceOutput { field_0 }) => field_0,
            Err(_) => return Err(ErrorCode::AbortedComputation.into()),
        };

        emit!(RebalanceEvent {
            encrypted_new_amount_a: o.ciphertexts[0],
            encrypted_new_amount_b: o.ciphertexts[1],
            encrypted_new_price_lower: o.ciphertexts[2],
            encrypted_new_price_upper: o.ciphertexts[3],
            nonce: o.nonce.to_le_bytes(),
        });
        Ok(())
    }

    #[arcium_callback(encrypted_ix = "view_position")]
    pub fn view_position_callback(
        ctx: Context<ViewPositionCallback>,
        output: SignedComputationOutputs<ViewPositionOutput>,
    ) -> Result<()> {
        let o = match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account,
        ) {
            Ok(ViewPositionOutput { field_0 }) => field_0,
            Err(_) => return Err(ErrorCode::AbortedComputation.into()),
        };

        emit!(ViewPositionEvent {
            encrypted_amount: o.ciphertexts[0],
            encrypted_price_lower: o.ciphertexts[1],
            encrypted_price_upper: o.ciphertexts[2],
            nonce: o.nonce.to_le_bytes(),
        });
        Ok(())
    }
}

// ============================================================
// Events
// ============================================================

#[event]
pub struct DepositEvent {
    pub encrypted_amount: [u8; 32],
    pub encrypted_price_lower: [u8; 32],
    pub encrypted_price_upper: [u8; 32],
    pub nonce: [u8; 16],
}

#[event]
pub struct RebalanceEvent {
    pub encrypted_new_amount_a: [u8; 32],
    pub encrypted_new_amount_b: [u8; 32],
    pub encrypted_new_price_lower: [u8; 32],
    pub encrypted_new_price_upper: [u8; 32],
    pub nonce: [u8; 16],
}

#[event]
pub struct ViewPositionEvent {
    pub encrypted_amount: [u8; 32],
    pub encrypted_price_lower: [u8; 32],
    pub encrypted_price_upper: [u8; 32],
    pub nonce: [u8; 16],
}

// ============================================================
// Init Comp Def Accounts (v0.8 style)
// ============================================================

#[init_computation_definition_accounts("encrypted_deposit", payer)]
#[derive(Accounts)]
pub struct InitEncryptedDepositCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    /// CHECK: comp_def_account, checked by arcium program
    pub comp_def_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_mxe_lut_pda!(mxe_account.lut_offset_slot))]
    /// CHECK: address_lookup_table, checked by arcium program
    pub address_lookup_table: UncheckedAccount<'info>,
    #[account(address = LUT_PROGRAM_ID)]
    /// CHECK: lut_program
    pub lut_program: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[init_computation_definition_accounts("encrypted_rebalance", payer)]
#[derive(Accounts)]
pub struct InitEncryptedRebalanceCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    /// CHECK: comp_def_account, checked by arcium program
    pub comp_def_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_mxe_lut_pda!(mxe_account.lut_offset_slot))]
    /// CHECK: address_lookup_table, checked by arcium program
    pub address_lookup_table: UncheckedAccount<'info>,
    #[account(address = LUT_PROGRAM_ID)]
    /// CHECK: lut_program
    pub lut_program: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[init_computation_definition_accounts("view_position", payer)]
#[derive(Accounts)]
pub struct InitViewPositionCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    /// CHECK: comp_def_account, checked by arcium program
    pub comp_def_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_mxe_lut_pda!(mxe_account.lut_offset_slot))]
    /// CHECK: address_lookup_table, checked by arcium program
    pub address_lookup_table: UncheckedAccount<'info>,
    #[account(address = LUT_PROGRAM_ID)]
    /// CHECK: lut_program
    pub lut_program: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

// ============================================================
// Queue Computation Accounts
// ============================================================

#[queue_computation_accounts("encrypted_deposit", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct EncryptedDeposit<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, ArciumSignerAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(mut, address = derive_mempool_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    /// CHECK: checked by arcium program
    pub mempool_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_execpool_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    /// CHECK: checked by arcium program
    pub executing_pool: UncheckedAccount<'info>,
    #[account(mut, address = derive_comp_pda!(computation_offset, mxe_account, ErrorCode::ClusterNotSet))]
    /// CHECK: checked by arcium program
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_ENCRYPTED_DEPOSIT))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(mut, address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,
    #[account(mut, address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

#[queue_computation_accounts("encrypted_rebalance", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct EncryptedRebalance<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, ArciumSignerAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(mut, address = derive_mempool_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    /// CHECK: checked by arcium program
    pub mempool_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_execpool_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    /// CHECK: checked by arcium program
    pub executing_pool: UncheckedAccount<'info>,
    #[account(mut, address = derive_comp_pda!(computation_offset, mxe_account, ErrorCode::ClusterNotSet))]
    /// CHECK: checked by arcium program
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_ENCRYPTED_REBALANCE))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(mut, address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,
    #[account(mut, address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

#[queue_computation_accounts("view_position", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct ViewPosition<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init_if_needed,
        space = 9,
        payer = payer,
        seeds = [&SIGN_PDA_SEED],
        bump,
        address = derive_sign_pda!(),
    )]
    pub sign_pda_account: Account<'info, ArciumSignerAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(mut, address = derive_mempool_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    /// CHECK: checked by arcium program
    pub mempool_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_execpool_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    /// CHECK: checked by arcium program
    pub executing_pool: UncheckedAccount<'info>,
    #[account(mut, address = derive_comp_pda!(computation_offset, mxe_account, ErrorCode::ClusterNotSet))]
    /// CHECK: checked by arcium program
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_VIEW_POSITION))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(mut, address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,
    #[account(mut, address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

// ============================================================
// Callback Accounts
// ============================================================

#[callback_accounts("encrypted_deposit")]
#[derive(Accounts)]
pub struct EncryptedDepositCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_ENCRYPTED_DEPOSIT))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    /// CHECK: checked by arcium program
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    /// CHECK: instructions sysvar
    pub instructions_sysvar: AccountInfo<'info>,
}

#[callback_accounts("encrypted_rebalance")]
#[derive(Accounts)]
pub struct EncryptedRebalanceCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_ENCRYPTED_REBALANCE))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    /// CHECK: checked by arcium program
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    /// CHECK: instructions sysvar
    pub instructions_sysvar: AccountInfo<'info>,
}

#[callback_accounts("view_position")]
#[derive(Accounts)]
pub struct ViewPositionCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_VIEW_POSITION))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    /// CHECK: checked by arcium program
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_cluster_pda!(mxe_account, ErrorCode::ClusterNotSet))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    /// CHECK: instructions sysvar
    pub instructions_sysvar: AccountInfo<'info>,
}

// ============================================================
// Error Codes
// ============================================================

#[error_code]
pub enum ErrorCode {
    #[msg("Computation was aborted by the MPC cluster")]
    AbortedComputation,
    #[msg("Cluster not set on MXE account")]
    ClusterNotSet,
}

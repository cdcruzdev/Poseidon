use anchor_lang::prelude::*;

declare_id!("2ro3VBKvqtc86DJVMnZETHMGAtjYFipZwdMFgtZGWscx");

#[program]
pub mod poseidon_rebalance {
    use super::*;

    /// Enable auto-rebalance for a specific LP position.
    /// Seeds: ["rebalance", owner, position_mint] — per-position granularity.
    pub fn enable_rebalance(
        ctx: Context<EnableRebalance>,
        max_slippage_bps: u16,
        min_yield_improvement_bps: u16,
    ) -> Result<()> {
        let config = &mut ctx.accounts.rebalance_config;
        let clock = Clock::get()?;

        if config.created_at == 0 {
            config.owner = ctx.accounts.owner.key();
            config.position_mint = ctx.accounts.position_mint.key();
            config.created_at = clock.unix_timestamp;
        }

        config.enabled = true;
        config.max_slippage_bps = max_slippage_bps;
        config.min_yield_improvement_bps = min_yield_improvement_bps;
        config.updated_at = clock.unix_timestamp;

        msg!(
            "Rebalance enabled for position {} by {}",
            ctx.accounts.position_mint.key(),
            ctx.accounts.owner.key()
        );
        Ok(())
    }

    /// Disable auto-rebalance for a specific position. Closes the config account
    /// and refunds rent to the owner.
    pub fn disable_rebalance(ctx: Context<DisableRebalance>) -> Result<()> {
        msg!(
            "Rebalance disabled for position {} by {}",
            ctx.accounts.position_mint.key(),
            ctx.accounts.owner.key()
        );
        Ok(())
    }

    /// Read-only: check if rebalance is enabled for a position.
    pub fn is_enabled(ctx: Context<IsEnabled>) -> Result<()> {
        let config = &ctx.accounts.rebalance_config;
        msg!(
            "Position {}: enabled={}, slippage={}, min_yield={}",
            config.position_mint,
            config.enabled,
            config.max_slippage_bps,
            config.min_yield_improvement_bps
        );
        Ok(())
    }
}

#[account]
pub struct RebalanceConfig {
    pub owner: Pubkey,                  // 32
    pub position_mint: Pubkey,          // 32
    pub enabled: bool,                  // 1
    pub max_slippage_bps: u16,          // 2
    pub min_yield_improvement_bps: u16, // 2
    pub created_at: i64,                // 8
    pub updated_at: i64,                // 8
}

impl RebalanceConfig {
    pub const LEN: usize = 8 + 32 + 32 + 1 + 2 + 2 + 8 + 8; // 93
}

#[derive(Accounts)]
pub struct EnableRebalance<'info> {
    #[account(
        init_if_needed,
        payer = owner,
        space = RebalanceConfig::LEN,
        seeds = [b"rebalance", owner.key().as_ref(), position_mint.key().as_ref()],
        bump,
    )]
    pub rebalance_config: Account<'info, RebalanceConfig>,

    #[account(mut)]
    pub owner: Signer<'info>,

    /// The position NFT mint (Orca/Raydium position mint, or Meteora position pubkey).
    /// CHECK: We don't validate the mint program — any pubkey can be used as an identifier.
    /// The security model is: only the owner can create/modify their own rebalance configs.
    pub position_mint: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DisableRebalance<'info> {
    #[account(
        mut,
        close = owner,
        seeds = [b"rebalance", owner.key().as_ref(), position_mint.key().as_ref()],
        bump,
        has_one = owner,
    )]
    pub rebalance_config: Account<'info, RebalanceConfig>,

    #[account(mut)]
    pub owner: Signer<'info>,

    /// CHECK: Validated via PDA seeds match.
    pub position_mint: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct IsEnabled<'info> {
    #[account(
        seeds = [b"rebalance", owner.key().as_ref(), position_mint.key().as_ref()],
        bump,
        has_one = owner,
    )]
    pub rebalance_config: Account<'info, RebalanceConfig>,

    pub owner: SystemAccount<'info>,

    /// CHECK: Validated via PDA seeds match.
    pub position_mint: UncheckedAccount<'info>,
}

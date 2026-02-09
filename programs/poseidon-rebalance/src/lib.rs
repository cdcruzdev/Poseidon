use anchor_lang::prelude::*;

declare_id!("2ro3VBKvqtc86DJVMnZETHMGAtjYFipZwdMFgtZGWscx");

#[program]
pub mod poseidon_rebalance {
    use super::*;

    pub fn enable_rebalance(
        ctx: Context<EnableRebalance>,
        max_slippage_bps: u16,
        min_yield_improvement_bps: u16,
    ) -> Result<()> {
        let config = &mut ctx.accounts.rebalance_config;
        let clock = Clock::get()?;

        if config.created_at == 0 {
            config.owner = ctx.accounts.owner.key();
            config.created_at = clock.unix_timestamp;
        }

        config.enabled = true;
        config.max_slippage_bps = max_slippage_bps;
        config.min_yield_improvement_bps = min_yield_improvement_bps;
        config.updated_at = clock.unix_timestamp;

        msg!("Rebalance enabled for {}", ctx.accounts.owner.key());
        Ok(())
    }

    pub fn disable_rebalance(ctx: Context<DisableRebalance>) -> Result<()> {
        msg!("Rebalance disabled for {}", ctx.accounts.owner.key());
        Ok(())
    }

    pub fn is_enabled(ctx: Context<IsEnabled>) -> Result<()> {
        let config = &ctx.accounts.rebalance_config;
        msg!("Rebalance enabled: {}, owner: {}, slippage: {}, min_yield: {}", 
            config.enabled, config.owner, config.max_slippage_bps, config.min_yield_improvement_bps);
        Ok(())
    }
}

#[account]
pub struct RebalanceConfig {
    pub owner: Pubkey,                  // 32
    pub enabled: bool,                  // 1
    pub max_slippage_bps: u16,          // 2
    pub min_yield_improvement_bps: u16, // 2
    pub created_at: i64,                // 8
    pub updated_at: i64,                // 8
}

impl RebalanceConfig {
    pub const LEN: usize = 8 + 32 + 1 + 2 + 2 + 8 + 8;
}

#[derive(Accounts)]
pub struct EnableRebalance<'info> {
    #[account(
        init_if_needed,
        payer = owner,
        space = RebalanceConfig::LEN,
        seeds = [b"rebalance", owner.key().as_ref()],
        bump,
    )]
    pub rebalance_config: Account<'info, RebalanceConfig>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DisableRebalance<'info> {
    #[account(
        mut,
        close = owner,
        seeds = [b"rebalance", owner.key().as_ref()],
        bump,
        has_one = owner,
    )]
    pub rebalance_config: Account<'info, RebalanceConfig>,

    #[account(mut)]
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct IsEnabled<'info> {
    #[account(
        seeds = [b"rebalance", owner.key().as_ref()],
        bump,
        has_one = owner,
    )]
    pub rebalance_config: Account<'info, RebalanceConfig>,

    pub owner: SystemAccount<'info>,
}

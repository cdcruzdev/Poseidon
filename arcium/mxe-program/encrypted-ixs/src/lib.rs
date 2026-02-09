use arcis::*;

#[encrypted]
mod circuits {
    use arcis::*;

    // === Encrypted Deposit ===
    pub struct DepositInput {
        amount_a: u64,
        amount_b: u64,
        tick_lower: i32,
        tick_upper: i32,
    }

    pub struct PositionData {
        amount_a: u64,
        amount_b: u64,
        tick_lower: i32,
        tick_upper: i32,
        liquidity: u64,
    }

    #[instruction]
    pub fn encrypted_deposit(input_ctxt: Enc<Shared, DepositInput>) -> Enc<Shared, PositionData> {
        let input = input_ctxt.to_arcis();

        // Simplified liquidity: sum of amounts (can't do sqrt in MPC easily)
        let liquidity = input.amount_a + input.amount_b;

        let position = PositionData {
            amount_a: input.amount_a,
            amount_b: input.amount_b,
            tick_lower: input.tick_lower,
            tick_upper: input.tick_upper,
            liquidity,
        };

        input_ctxt.owner.from_arcis(position)
    }

    // === Encrypted Rebalance ===
    pub struct RebalanceInput {
        current_amount_a: u64,
        current_amount_b: u64,
        current_tick_lower: i32,
        current_tick_upper: i32,
        new_tick_lower: i32,
        new_tick_upper: i32,
        current_price_x64: u64,
    }

    pub struct RebalanceOutput {
        new_amount_a: u64,
        new_amount_b: u64,
        new_tick_lower: i32,
        new_tick_upper: i32,
        new_liquidity: u64,
    }

    #[instruction]
    pub fn encrypted_rebalance(input_ctxt: Enc<Shared, RebalanceInput>) -> Enc<Shared, RebalanceOutput> {
        let input = input_ctxt.to_arcis();

        // Total value = amount_a * price + amount_b (simplified — avoid bitshift)
        // Use price_x64 as a simple multiplier / 1000 for scaling
        let value_a = input.current_amount_a * input.current_price_x64 / 1000u64;
        let total_value = value_a + input.current_amount_b;

        // Split 50/50
        let half = total_value / 2u64;
        let new_amount_b = half;
        let new_amount_a = if input.current_price_x64 > 0u64 {
            half * 1000u64 / input.current_price_x64
        } else {
            0u64
        };

        let new_liquidity = new_amount_a + new_amount_b;

        let output = RebalanceOutput {
            new_amount_a,
            new_amount_b,
            new_tick_lower: input.new_tick_lower,
            new_tick_upper: input.new_tick_upper,
            new_liquidity,
        };

        input_ctxt.owner.from_arcis(output)
    }

    // === View Position ===
    pub struct ViewInput {
        amount_a: u64,
        amount_b: u64,
        tick_lower: i32,
        tick_upper: i32,
        liquidity: u64,
    }

    pub struct ViewOutput {
        amount_a: u64,
        amount_b: u64,
        tick_lower: i32,
        tick_upper: i32,
        liquidity: u64,
    }

    #[instruction]
    pub fn view_position(input_ctxt: Enc<Shared, ViewInput>) -> Enc<Shared, ViewOutput> {
        let input = input_ctxt.to_arcis();

        let output = ViewOutput {
            amount_a: input.amount_a,
            amount_b: input.amount_b,
            tick_lower: input.tick_lower,
            tick_upper: input.tick_upper,
            liquidity: input.liquidity,
        };

        input_ctxt.owner.from_arcis(output)
    }
}

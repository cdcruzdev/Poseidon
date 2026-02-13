/**
 * AI Reasoning Layer
 * 
 * Uses Kimi K2.5 (via NVIDIA NIM) to make intelligent rebalancing decisions.
 * Instead of blindly rebalancing when price exits range, the AI analyzes
 * market conditions, volatility, gas costs, and position health to decide
 * the optimal action.
 */

import Decimal from 'decimal.js';
import { Position, RebalanceDecision, PoolInfo } from '../types/index.js';
import { ReasoningLogger } from './reasoning-logger.js';

export interface MarketContext {
  currentPrice: Decimal;
  priceChange1h: number;    // percentage
  priceChange24h: number;   // percentage
  volatility24h: number;    // percentage (std dev)
  poolTvl: Decimal;
  poolVolume24h: Decimal;
  poolFeeRate: number;      // bps
  currentYield24h: number;  // percentage
  gasEstimateSol: number;
  positionValueUsd: number;
}

export interface AIDecision {
  action: 'rebalance' | 'wait' | 'migrate' | 'close';
  confidence: number;       // 0-1
  reasoning: string;
  suggestedRange?: { lower: number; upper: number };
  migrationTarget?: string; // pool address if action is 'migrate'
  waitDurationMs?: number;  // how long to wait before re-checking
}

export class AIReasoner {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private logger: ReasoningLogger | null;

  constructor(
    apiKey: string = process.env.NVIDIA_API_KEY || '',
    baseUrl: string = process.env.AI_BASE_URL || 'https://integrate.api.nvidia.com/v1',
    model: string = process.env.AI_MODEL || 'moonshotai/kimi-k2.5',
    logger?: ReasoningLogger
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.model = model;
    this.logger = logger || null;
  }

  get isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Analyze whether a rebalance should be executed now.
   * Called by PositionMonitor before every rebalance.
   */
  async analyzeRebalance(
    position: Position,
    context: MarketContext,
    trigger: string
  ): Promise<AIDecision> {
    if (!this.apiKey) {
      // Fallback: approve the rebalance (backwards compatible)
      return {
        action: 'rebalance',
        confidence: 0.5,
        reasoning: 'AI reasoning unavailable, proceeding with rule-based decision.',
      };
    }

    const prompt = this.buildPrompt(position, context, trigger);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: SYSTEM_PROMPT,
            },
            {
              role: 'user',
              content: prompt + '\n\nRespond ONLY with:\nAction: [rebalance/wait/migrate/close]\nConfidence: [0.0-1.0]\nReasoning: [2-3 sentences]',
            },
          ],
          temperature: 0.3,
          max_tokens: 300,
          thinking: { type: 'disabled' },
        }),
      });

      const responseText = await response.text();
      if (!response.ok) {
        console.error(`[AI Reasoner] API error ${response.status}: ${responseText}`);
        return this.fallbackDecision(trigger);
      }

      const data = JSON.parse(responseText) as any;
      const msg = data.choices?.[0]?.message;
      // Kimi K2.5 in thinking mode returns reasoning in `reasoning` field, content may be null
      const content = msg?.content || msg?.reasoning || '';
      console.log(`[AI Reasoner] Raw response:\n${content.slice(0, 500)}\n`);

      const decision = this.parseDecision(content);

      // Log the reasoning
      if (this.logger) {
        this.logger.log({
          positionId: position.id,
          trigger,
          shouldRebalance: decision.action === 'rebalance',
          reason: decision.reasoning || content.slice(0, 200),
          estimatedBenefit: decision.confidence,
        });
      }

      console.log(`[AI Reasoner] Decision for ${position.id}: ${decision.action} (${(decision.confidence * 100).toFixed(0)}% confidence)`);
      console.log(`[AI Reasoner] Reasoning: ${decision.reasoning}`);

      return decision;
    } catch (error) {
      console.error('[AI Reasoner] Error:', error);
      return this.fallbackDecision(trigger);
    }
  }

  /**
   * Analyze whether migrating to a different pool is worthwhile.
   */
  async analyzeMigration(
    position: Position,
    currentPool: PoolInfo,
    candidatePool: PoolInfo,
    migrationCostUsd: number
  ): Promise<AIDecision> {
    if (!this.apiKey) {
      return {
        action: 'wait',
        confidence: 0.5,
        reasoning: 'AI reasoning unavailable for migration analysis.',
      };
    }

    const prompt = `MIGRATION ANALYSIS
Current pool: ${currentPool.tokenASymbol}/${currentPool.tokenBSymbol} on ${currentPool.dex}
- TVL: $${currentPool.tvl.toFixed(0)}
- 24h Yield: ${currentPool.apr24h?.toFixed(4) || 'unknown'}%
- Fee: ${currentPool.fee}bps

Candidate pool: ${candidatePool.tokenASymbol}/${candidatePool.tokenBSymbol} on ${candidatePool.dex}
- TVL: $${candidatePool.tvl.toFixed(0)}
- 24h Yield: ${candidatePool.apr24h?.toFixed(4) || 'unknown'}%
- Fee: ${candidatePool.fee}bps

Migration cost: $${migrationCostUsd.toFixed(2)} (gas + slippage)
Position value: ~$${position.strategy.targetDailyYield ? 'unknown' : 'unknown'}

Should we migrate? Consider if the yield improvement justifies the migration cost and risk.`;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 512,
        }),
      });

      if (!response.ok) return this.fallbackDecision('migration');
      const data = await response.json() as any;
      return this.parseDecision(data.choices?.[0]?.message?.content || '');
    } catch {
      return this.fallbackDecision('migration');
    }
  }

  private buildPrompt(position: Position, ctx: MarketContext, trigger: string): string {
    return `REBALANCE DECISION REQUIRED

Position: ${position.id}
DEX: ${position.dex}
Range: [${position.lowerPrice.toFixed(6)}, ${position.upperPrice.toFixed(6)}]
Current Price: ${ctx.currentPrice.toFixed(6)}
Trigger: ${trigger}

MARKET DATA:
- Price change (1h): ${ctx.priceChange1h > 0 ? '+' : ''}${ctx.priceChange1h.toFixed(2)}%
- Price change (24h): ${ctx.priceChange24h > 0 ? '+' : ''}${ctx.priceChange24h.toFixed(2)}%
- 24h volatility: ${ctx.volatility24h.toFixed(2)}%
- Pool TVL: $${ctx.poolTvl.toFixed(0)}
- Pool 24h volume: $${ctx.poolVolume24h.toFixed(0)}
- Pool fee rate: ${ctx.poolFeeRate}bps
- Current 24h yield: ${ctx.currentYield24h.toFixed(4)}%

COSTS:
- Estimated gas: ${ctx.gasEstimateSol.toFixed(4)} SOL
- Position value: $${ctx.positionValueUsd.toFixed(2)}
- Gas as % of position: ${((ctx.gasEstimateSol * 150) / ctx.positionValueUsd * 100).toFixed(3)}%

USER STRATEGY:
- Auto-rebalance: enabled
- Target daily yield: ${position.strategy.targetDailyYield?.toFixed(4) || 'not set'}%
- Min rebalance interval: ${position.strategy.minRebalanceInterval}s

What action should the agent take? Consider gas costs relative to position size, current market volatility, and whether waiting might be more profitable.`;
  }

  private parseDecision(content: string): AIDecision {
    const lower = content.toLowerCase();

    let action: AIDecision['action'] = 'wait';
    if (lower.includes('"action": "rebalance"') || lower.includes('action: rebalance') || /\brebalance now\b/.test(lower)) {
      action = 'rebalance';
    } else if (lower.includes('"action": "migrate"') || lower.includes('action: migrate')) {
      action = 'migrate';
    } else if (lower.includes('"action": "close"') || lower.includes('action: close')) {
      action = 'close';
    } else if (lower.includes('"action": "wait"') || lower.includes('action: wait') || /\bwait\b/.test(lower) || /\bhold\b/.test(lower)) {
      action = 'wait';
    }

    // Try to extract confidence
    let confidence = 0.7;
    const confMatch = content.match(/confidence[:\s]*([0-9.]+)/i);
    if (confMatch) {
      const val = parseFloat(confMatch[1]);
      confidence = val > 1 ? val / 100 : val;
    }

    // Extract reasoning
    let reasoning = 'No reasoning provided.';
    const reasoningMatch = content.match(/[Rr]easoning[:\s]*(.+?)(?:\n\n|$)/s);
    if (reasoningMatch) {
      reasoning = reasoningMatch[1].trim().slice(0, 300);
    } else {
      // Fallback: grab any substantial lines that aren't just the action/confidence
      const lines = content.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 15 && !/^(action|confidence)[:\s]/i.test(l));
      if (lines.length > 0) {
        reasoning = lines.slice(0, 3).join(' ').slice(0, 300);
      }
    }

    return { action, confidence, reasoning };
  }

  private fallbackDecision(trigger: string): AIDecision {
    // If AI is unavailable, use simple heuristics
    if (trigger === 'price_exit') {
      return {
        action: 'rebalance',
        confidence: 0.6,
        reasoning: 'AI unavailable. Price exited range, proceeding with rule-based rebalance.',
      };
    }
    return {
      action: 'wait',
      confidence: 0.5,
      reasoning: 'AI unavailable. No urgent trigger detected, waiting.',
    };
  }
}

const SYSTEM_PROMPT = `You are an autonomous DeFi agent managing concentrated liquidity positions on Solana.

Your job: decide whether to REBALANCE, WAIT, MIGRATE, or CLOSE a position based on market data.

Decision framework:
- REBALANCE: price has left the range AND volatility is settling AND gas cost is <1% of position value
- WAIT: price just spiked (high 1h change) and may revert, OR gas cost is too high relative to position, OR volatility is too high (rebalancing into a new range that might break again is wasteful)
- MIGRATE: a significantly better pool exists (>50% yield improvement sustained, after accounting for migration costs)
- CLOSE: position is unprofitable and unlikely to recover (extreme IL, dead pool, TVL crashed)

Key principles:
- Never rebalance during high volatility spikes (wait for price to settle)
- Gas costs matter more for small positions
- Frequent rebalancing destroys returns through fees
- A position slightly out of range still earns some fees on most DEXs
- When in doubt, WAIT. Patience beats reactivity in LP management.

Respond with:
Action: [rebalance/wait/migrate/close]
Confidence: [0.0-1.0]
Reasoning: [2-3 sentences explaining your decision]`;

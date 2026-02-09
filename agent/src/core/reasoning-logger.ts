/**
 * Reasoning Logger
 * 
 * Captures the agent's decision-making process for positions.
 * PositionMonitor (or other components) push reasoning entries here.
 */

export interface ReasoningDecision {
  timestamp: number;
  positionId: string;
  trigger: string;
  shouldRebalance: boolean;
  reason: string;
  estimatedBenefit?: number;
  estimatedCost?: number;
  riskScore?: number;
}

const MAX_DECISIONS = 50;

export class ReasoningLogger {
  private decisions: ReasoningDecision[] = [];
  private static instance: ReasoningLogger | null = null;

  static getInstance(): ReasoningLogger {
    if (!ReasoningLogger.instance) {
      ReasoningLogger.instance = new ReasoningLogger();
    }
    return ReasoningLogger.instance;
  }

  log(decision: Omit<ReasoningDecision, 'timestamp'>): void {
    this.decisions.push({ timestamp: Date.now(), ...decision });
    if (this.decisions.length > MAX_DECISIONS) {
      this.decisions = this.decisions.slice(-MAX_DECISIONS);
    }
  }

  getAll(): ReasoningDecision[] {
    return [...this.decisions].reverse(); // newest first
  }

  clear(): void {
    this.decisions = [];
  }
}

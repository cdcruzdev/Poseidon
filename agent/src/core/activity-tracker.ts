/**
 * Agent Activity Tracker
 * 
 * In-memory log of agent actions, capped at 100 entries.
 * Other components push events here; the API reads them.
 */

export type ActivityType =
  | 'rebalance_check'
  | 'fee_collection'
  | 'position_opened'
  | 'position_closed'
  | 'price_alert'
  | 'health_check'
  | 'migration_check'
  | 'agent_started'
  | 'agent_stopped';

export interface Activity {
  timestamp: number;
  type: ActivityType;
  message: string;
  details?: Record<string, unknown>;
}

const MAX_ACTIVITIES = 100;

export class AgentActivityTracker {
  private activities: Activity[] = [];
  private static instance: AgentActivityTracker | null = null;

  static getInstance(): AgentActivityTracker {
    if (!AgentActivityTracker.instance) {
      AgentActivityTracker.instance = new AgentActivityTracker();
    }
    return AgentActivityTracker.instance;
  }

  push(type: ActivityType, message: string, details?: Record<string, unknown>): void {
    this.activities.push({ timestamp: Date.now(), type, message, details });
    if (this.activities.length > MAX_ACTIVITIES) {
      this.activities = this.activities.slice(-MAX_ACTIVITIES);
    }
  }

  getAll(): Activity[] {
    return [...this.activities].reverse(); // newest first
  }

  clear(): void {
    this.activities = [];
  }
}

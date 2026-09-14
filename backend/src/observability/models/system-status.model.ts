import type { QueryResultRow } from 'pg';

export type DependencyState = 'up' | 'down';
export type SystemState = 'healthy' | 'degraded';

export interface DependencyStatus {
  status: DependencyState;
}

export interface WorkerStatus {
  status: string;
  checkpoint: number;
  processedCount: number;
  lastError: string | null;
}

export interface SystemStatus {
  status: SystemState;
  checkedAt: string;

  dependencies: {
    database: DependencyStatus;
    elasticsearch: DependencyStatus;
    rabbitmq: DependencyStatus;
  };

  workers: {
    backfill: WorkerStatus | null;
    incrementalSync: WorkerStatus | null;
  };
}

export type WorkerName = 'backfill' | 'incrementalSync';

export interface WorkerStatusRow extends QueryResultRow {
  worker_name: WorkerName;
  status: string;
  checkpoint: string;
  processed_count: string;
  last_error: string | null;
}

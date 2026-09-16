import type { QueryResultRow } from 'pg';

import type {
  WorkerName,
  WorkerState,
} from '../../workers/models/worker-command-response.model.js';

export type DependencyState = 'up' | 'down';
export type SystemState = 'healthy' | 'degraded';

export interface DependencyStatus {
  status: DependencyState;
}

export interface WorkerStatus {
  status: WorkerState;
  checkpoint: number;
  processedCount: number;
  stopRequested: boolean;
  lastError: string | null;
}

export interface PipelineCounters {
  deliveredEvents: number;
  elasticsearchRetries: number;
  rabbitMqRetries: number;
  processedEvents: number;
  duplicateEvents: number;
  deadLetterEvents: number;
}

export interface PipelineStatus {
  sourceRecordCount: number | null;
  latestChangeId: number | null;
  processedChangeId: number | null;
  incrementalLag: number | null;
  throughputPerSecond: number | null;
  mainQueueMessageCount: number | null;
  deadLetterQueueMessageCount: number | null;
  counters: PipelineCounters | null;
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

  pipeline: PipelineStatus;
}

export interface WorkerStatusRow extends QueryResultRow {
  worker_name: WorkerName;
  status: WorkerState;
  checkpoint: string;
  processed_count: string;
  stop_requested: boolean;
  last_error: string | null;
}

export interface PipelineSnapshotRow extends QueryResultRow {
  source_record_count: string;
  latest_change_id: string;
  processed_change_id: string;
  processed_last_minute: string;
}

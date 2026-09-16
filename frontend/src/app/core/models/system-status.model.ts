export type SystemHealth = 'healthy' | 'degraded';
export type DependencyHealth = 'up' | 'down';

export type WorkerStatus = 'pending' | 'running' | 'stopped' | 'completed' | 'failed';

export interface DependencyStatus {
  status: DependencyHealth;
}

export interface WorkerState {
  status: WorkerStatus;
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
  counters: PipelineCounters | null;
  mainQueueMessageCount: number | null;
  deadLetterQueueMessageCount: number | null;
}

export interface SystemStatus {
  status: SystemHealth;
  checkedAt: string;

  dependencies: {
    database: DependencyStatus;
    elasticsearch: DependencyStatus;
    rabbitmq: DependencyStatus;
  };

  workers: {
    backfill: WorkerState | null;
    incrementalSync: WorkerState | null;
  };

  pipeline: PipelineStatus;
}

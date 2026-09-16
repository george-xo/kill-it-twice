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
  rabbitmqRetries: number;
  processedEvents: number;
  duplicateEvents: number;
  deadLetterEvents: number;
}

export interface PipelineStatus {
  sourceRecordCount: number;
  latestChangeId: number;
  processedChangeId: number;
  incrementalLag: number;
  throughputPerSecond: number;
  counters: PipelineCounters;
  mainQueueMessageCount: number;
  deadLetterQueueMessageCount: number;
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
    backfill: WorkerState;
    incrementalSync: WorkerState;
  };

  pipeline: PipelineStatus;
}

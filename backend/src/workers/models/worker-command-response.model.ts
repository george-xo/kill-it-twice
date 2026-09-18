export const WORKER_NAMES = {
  BACKFILL: 'backfill',
  INCREMENTAL_SYNC: 'incrementalSync',
} as const;

export type WorkerName = (typeof WORKER_NAMES)[keyof typeof WORKER_NAMES];

export const WORKER_STATES = {
  PENDING: 'pending',
  RUNNING: 'running',
  STOPPED: 'stopped',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type WorkerState = (typeof WORKER_STATES)[keyof typeof WORKER_STATES];

export type WorkerRequestedState =
  typeof WORKER_STATES.RUNNING | typeof WORKER_STATES.STOPPED;

export interface WorkerCommandResponse {
  worker: WorkerName;
  requestedState: WorkerRequestedState;
  acceptedAt: string;
}

import type { WorkerStatus } from '../models/system-status.model';

export const WORKER_STATUSES = {
  PENDING: 'pending',
  RUNNING: 'running',
  STOPPED: 'stopped',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const satisfies Record<string, WorkerStatus>;

export const SHARED_DISPLAY_LABELS = {
  UNAVAILABLE: 'Unavailable',
} as const;

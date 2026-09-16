import type { WorkerName } from '../models/operation.model';

export const DEFAULT_DLQ_REPLAY_LIMIT = 25;
export const MAX_DLQ_REPLAY_LIMIT = 500;

export const DLQ_REPLAY_TIMEOUT_MS = 45_000;

export const WORKER_STATUS_POLL_INTERVAL_MS = 250;
export const WORKER_STATUS_TIMEOUT_MS = 5_000;

export const WORKER_NAMES = {
  BACKFILL: 'backfill',
  INCREMENTAL_SYNC: 'incrementalSync',
} as const satisfies Record<string, WorkerName>;

export const OPERATIONS_MESSAGES = {
  STATUS_LOAD_FAILED: 'System status could not be loaded',
  WORKER_REQUEST_ACCEPTED: 'Worker command accepted',
  WORKER_UPDATE_FAILED: 'Worker state could not be confirmed',
  DLQ_REPLAY_FAILED: 'DLQ replay request could not be completed',
} as const;

export const OPERATIONS_LABELS = {
  REPLAY: 'Replay',
  REPLAYING: 'Replaying...',
  LOADING_STATUS: 'Loading current system status...',
} as const;

export function createDlqReplaySuccessMessage(replayed: number, remaining: number): string {
  return `DLQ replay completed: ${replayed} replayed, ${remaining} remaining`;
}

export function createDlqReplayFailureMessage(
  replayed: number,
  failed: number,
  remaining: number,
): string {
  return `DLQ replay finished: ${replayed} replayed, ${failed} failed, ${remaining} remaining`;
}

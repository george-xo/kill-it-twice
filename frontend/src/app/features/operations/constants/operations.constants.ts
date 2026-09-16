export const DEFAULT_DLQ_REPLAY_LIMIT = 25;
export const MAX_DLQ_REPLAY_LIMIT = 1000;

export const OPERATIONS_MESSAGES = {
  STATUS_LOAD_FAILED: 'System status could not be loaded',
  WORKER_UPDATED: 'Worker state updated successfully',
  WORKER_UPDATE_FAILED: 'Worker state could not be updated',
  DLQ_REPLAY_FAILED: 'DLQ replay request could not be completed',
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

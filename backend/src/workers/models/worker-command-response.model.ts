export type WorkerName = 'backfill' | 'incrementalSync';
export type WorkerRequestedState = 'running' | 'stopped';

export interface WorkerCommandResponse {
  worker: WorkerName;
  requestedState: WorkerRequestedState;
  acceptedAt: string;
}

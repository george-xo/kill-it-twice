export type WorkerName = 'backfill' | 'incrementalSync';
export type RequestedWorkerState = 'running' | 'stopped';

export interface WorkerCommandResponse {
  worker: WorkerName;
  requestedState: RequestedWorkerState;
  acceptedAt: string;
}

export interface DeadLetterReplayResponse {
  requestedLimit: number;
  processed: number;
  replayed: number;
  failed: number;
  remaining: number;
}

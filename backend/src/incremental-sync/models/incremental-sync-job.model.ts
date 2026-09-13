import type { QueryResultRow } from 'pg';

export type IncrementalSyncJobStatus =
  'pending' | 'running' | 'stopped' | 'failed';

export interface IncrementalSyncJobRow extends QueryResultRow {
  name: string;
  status: IncrementalSyncJobStatus;
  start_change_id: string;
  last_processed_change_id: string;
  processed_count: string;
  started_at: Date | null;
  updated_at: Date;
  last_error: string | null;
}

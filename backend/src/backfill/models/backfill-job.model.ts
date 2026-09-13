import type { QueryResultRow } from 'pg';

export type BackfillJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface BackfillJobRow extends QueryResultRow {
  name: string;
  status: BackfillJobStatus;
  snapshot_max_id: string;
  last_processed_id: string;
  incremental_start_change_id: string;
  processed_count: string;
  started_at: Date | null;
  updated_at: Date;
  completed_at: Date | null;
  last_error: string | null;
}

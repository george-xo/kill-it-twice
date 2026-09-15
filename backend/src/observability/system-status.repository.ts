import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import type {
  PipelineSnapshotRow,
  SystemStatus,
  WorkerStatusRow,
} from './models/system-status.model.js';

@Injectable()
export class SystemStatusRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async pingDatabase(): Promise<void> {
    await this.databaseService.query('SELECT 1;');
  }

  async findWorkerStatuses(): Promise<SystemStatus['workers']> {
    const result = await this.databaseService.query<WorkerStatusRow>(`
      SELECT
        'backfill' AS worker_name,
        status,
        last_processed_id AS checkpoint,
        processed_count,
        stop_requested,
        last_error
      FROM backfill_jobs
      WHERE name = 'customers'

      UNION ALL

      SELECT
        'incrementalSync' AS worker_name,
        status,
        last_processed_change_id AS checkpoint,
        processed_count,
        stop_requested,
        last_error
      FROM incremental_sync_jobs
      WHERE name = 'customers';
    `);

    const workers: SystemStatus['workers'] = {
      backfill: null,
      incrementalSync: null,
    };

    for (const row of result.rows) {
      workers[row.worker_name] = {
        status: row.status,
        checkpoint: Number(row.checkpoint),
        processedCount: Number(row.processed_count),
        stopRequested: row.stop_requested,
        lastError: row.last_error,
      };
    }

    return workers;
  }

  async findPipelineSnapshot(): Promise<PipelineSnapshotRow> {
    const result = await this.databaseService.query<PipelineSnapshotRow>(`
      SELECT
        (
          SELECT COUNT(*)::TEXT
          FROM customers
        ) AS source_record_count,

        (
          SELECT COALESCE(MAX(id), 0)::TEXT
          FROM change_log
        ) AS latest_change_id,

        (
          SELECT COALESCE(
            MAX(last_processed_change_id),
            0
          )::TEXT
          FROM incremental_sync_jobs
          WHERE name = 'customers'
        ) AS processed_change_id,

        (
          SELECT COUNT(*)::TEXT
          FROM consumer_processed_events
          WHERE processed_at >= NOW() - INTERVAL '1 minute'
        ) AS processed_last_minute;
    `);

    const snapshot = result.rows[0];

    if (!snapshot) {
      throw new Error('Pipeline status snapshot was not returned');
    }

    return snapshot;
  }
}

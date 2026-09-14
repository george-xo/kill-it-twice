import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import type {
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
        last_error
      FROM backfill_jobs
      WHERE name = 'customers'

      UNION ALL

      SELECT
        'incrementalSync' AS worker_name,
        status,
        last_processed_change_id AS checkpoint,
        processed_count,
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
        lastError: row.last_error,
      };
    }

    return workers;
  }
}

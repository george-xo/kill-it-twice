import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import type { IncrementalSyncJobRow } from './models/incremental-sync-job.model.js';

@Injectable()
export class IncrementalSyncJobRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async getOrCreate(
    name: string,
    startChangeId: string,
  ): Promise<IncrementalSyncJobRow> {
    return this.databaseService.withTransaction(async (client) => {
      await client.query(
        `
          INSERT INTO incremental_sync_jobs (
            name,
            start_change_id,
            last_processed_change_id
          )
          VALUES (
            $1,
            $2::BIGINT,
            $2::BIGINT
          )
          ON CONFLICT (name) DO NOTHING;
        `,
        [name, startChangeId],
      );

      const result = await client.query<IncrementalSyncJobRow>(
        `
          SELECT
            name,
            status,
            start_change_id::TEXT,
            last_processed_change_id::TEXT,
            processed_count::TEXT,
            started_at,
            updated_at,
            last_error
          FROM incremental_sync_jobs
          WHERE name = $1;
        `,
        [name],
      );

      const job = result.rows[0];

      if (!job) {
        throw new Error(`Incremental sync job "${name}" was not found`);
      }

      return job;
    });
  }

  async markRunning(name: string): Promise<void> {
    await this.databaseService.query(
      `
        UPDATE incremental_sync_jobs
        SET
          status = 'running',
          started_at = COALESCE(started_at, NOW()),
          updated_at = NOW(),
          last_error = NULL
        WHERE name = $1;
      `,
      [name],
    );
  }

  async saveCheckpoint(
    name: string,
    lastProcessedChangeId: string,
    processedCount: number,
  ): Promise<void> {
    await this.databaseService.query(
      `
        UPDATE incremental_sync_jobs
        SET
          last_processed_change_id = GREATEST(
            last_processed_change_id,
            $2::BIGINT
          ),
          processed_count = processed_count + $3::BIGINT,
          updated_at = NOW()
        WHERE name = $1;
      `,
      [name, lastProcessedChangeId, processedCount],
    );
  }

  async markStopped(name: string): Promise<void> {
    await this.databaseService.query(
      `
        UPDATE incremental_sync_jobs
        SET
          status = 'stopped',
          updated_at = NOW()
        WHERE name = $1;
      `,
      [name],
    );
  }

  async markFailed(name: string, error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await this.databaseService.query(
      `
        UPDATE incremental_sync_jobs
        SET
          status = 'failed',
          updated_at = NOW(),
          last_error = $2
        WHERE name = $1;
      `,
      [name, errorMessage],
    );
  }
}

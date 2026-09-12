import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { BackfillJobRow } from './models/backfill-job.model.js';

@Injectable()
export class BackfillJobRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async getOrCreate(name: string): Promise<BackfillJobRow> {
    return this.databaseService.withTransaction(async (client) => {
      await client.query(
        `
          INSERT INTO backfill_jobs (
            name,
            snapshot_max_id
          )
          SELECT
            $1,
            COALESCE(MAX(id), 0)
          FROM customers
          ON CONFLICT (name) DO NOTHING;
        `,
        [name],
      );

      const result = await client.query<BackfillJobRow>(
        `
          SELECT
            name,
            status,
            snapshot_max_id::TEXT,
            last_processed_id::TEXT,
            processed_count::TEXT,
            started_at,
            updated_at,
            completed_at,
            last_error
          FROM backfill_jobs
          WHERE name = $1;
        `,
        [name],
      );

      const job = result.rows[0];

      if (!job) {
        throw new Error(`Backfill job "${name}" was not found`);
      }

      return job;
    });
  }

  async markRunning(name: string): Promise<void> {
    const result = await this.databaseService.query(
      `
      UPDATE backfill_jobs
      SET
        status = 'running',
        started_at = COALESCE(started_at, NOW()),
        updated_at = NOW(),
        completed_at = NULL,
        last_error = NULL
      WHERE name = $1
        AND status IN ('pending', 'running', 'failed')
      RETURNING name;
    `,
      [name],
    );

    if (result.rowCount !== 1) {
      throw new Error(
        `Backfill job "${name}" cannot be moved to running state`,
      );
    }
  }

  async saveCheckpoint(
    name: string,
    lastProcessedId: string,
    batchProcessedCount: number,
  ): Promise<void> {
    const result = await this.databaseService.query(
      `
      UPDATE backfill_jobs
      SET
        last_processed_id = $2::BIGINT,
        processed_count = processed_count + $3::BIGINT,
        updated_at = NOW(),
        last_error = NULL
      WHERE name = $1
        AND status = 'running'
        AND last_processed_id < $2::BIGINT
        AND $2::BIGINT <= snapshot_max_id
      RETURNING name;
    `,
      [name, lastProcessedId, batchProcessedCount],
    );

    if (result.rowCount !== 1) {
      throw new Error(
        `Checkpoint "${lastProcessedId}" could not be saved for backfill job "${name}"`,
      );
    }
  }

  async markCompleted(name: string): Promise<void> {
    const result = await this.databaseService.query(
      `
      UPDATE backfill_jobs
      SET
        status = 'completed',
        last_processed_id = snapshot_max_id,
        updated_at = NOW(),
        completed_at = NOW(),
        last_error = NULL
      WHERE name = $1
        AND status = 'running'
      RETURNING name;
    `,
      [name],
    );

    if (result.rowCount !== 1) {
      throw new Error(
        `Backfill job "${name}" cannot be moved to completed state`,
      );
    }
  }

  async markFailed(name: string, errorMessage: string): Promise<void> {
    const result = await this.databaseService.query(
      `
      UPDATE backfill_jobs
      SET
        status = 'failed',
        updated_at = NOW(),
        completed_at = NULL,
        last_error = $2
      WHERE name = $1
        AND status = 'running'
      RETURNING name;
    `,
      [name, errorMessage],
    );

    if (result.rowCount !== 1) {
      throw new Error(`Backfill job "${name}" cannot be moved to failed state`);
    }
  }
}

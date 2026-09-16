import { Injectable } from '@nestjs/common';
import type { QueryResultRow } from 'pg';

import { DatabaseService } from '../../database/database.service.js';
import type { BackfillJobRow } from '../models/backfill-job.model.js';

interface StopRequestedRow extends QueryResultRow {
  stop_requested: boolean;
}

@Injectable()
export class BackfillJobRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async getOrCreate(name: string): Promise<BackfillJobRow> {
    return this.databaseService.withTransaction(async (client) => {
      await client.query(
        `
          INSERT INTO backfill_jobs (
            name,
            snapshot_max_id,
            incremental_start_change_id
          )
          VALUES (
            $1,
            (
              SELECT COALESCE(MAX(id), 0)
              FROM customers
            ),
            (
              SELECT COALESCE(MAX(id), 0)
              FROM change_log
            )
          )
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
            incremental_start_change_id::TEXT,
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

  async requestStart(name: string): Promise<void> {
    const result = await this.databaseService.query(
      `
        UPDATE backfill_jobs
        SET
          stop_requested = FALSE,
          updated_at = NOW()
        WHERE name = $1
          AND status <> 'completed'
        RETURNING name;
      `,
      [name],
    );

    if (result.rowCount !== 1) {
      throw new Error(`Backfill job "${name}" cannot accept a start request`);
    }
  }

  async requestStop(name: string): Promise<void> {
    const result = await this.databaseService.query(
      `
        UPDATE backfill_jobs
        SET
          stop_requested = TRUE,
          updated_at = NOW()
        WHERE name = $1
        RETURNING name;
      `,
      [name],
    );

    if (result.rowCount !== 1) {
      throw new Error(`Backfill job "${name}" cannot accept a stop request`);
    }
  }

  async isStopRequested(name: string): Promise<boolean> {
    const result = await this.databaseService.query<StopRequestedRow>(
      `
          SELECT stop_requested
          FROM backfill_jobs
          WHERE name = $1;
        `,
      [name],
    );

    return result.rows[0]?.stop_requested ?? false;
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
          AND status IN (
            'pending',
            'running',
            'stopped',
            'failed'
          )
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

  async markStopped(name: string): Promise<void> {
    const result = await this.databaseService.query(
      `
        UPDATE backfill_jobs
        SET
          status = 'stopped',
          updated_at = NOW(),
          completed_at = NULL,
          last_error = NULL
        WHERE name = $1
          AND status IN ('running', 'stopped')
        RETURNING name;
      `,
      [name],
    );

    if (result.rowCount !== 1) {
      throw new Error(
        `Backfill job "${name}" cannot be moved to stopped state`,
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
          stop_requested = FALSE,
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

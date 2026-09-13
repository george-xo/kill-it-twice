import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

const DEFAULT_BATCH_SIZE = 5_000;

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async seed(
    count: number,
    batchSize: number = DEFAULT_BATCH_SIZE,
  ): Promise<void> {
    this.validatePositiveInteger(count, 'count');
    this.validatePositiveInteger(batchSize, 'batchSize');

    await this.databaseService.query(`
      TRUNCATE TABLE
        consumer_processed_events,
        incremental_sync_jobs,
        backfill_jobs,
        customers,
        change_log
      RESTART IDENTITY;
`);

    for (let start = 1; start <= count; start += batchSize) {
      const end = Math.min(start + batchSize - 1, count);

      await this.insertBatch(start, end);

      this.logger.log(`Seeded ${end}/${count} customers`);
    }
  }

  private async insertBatch(start: number, end: number): Promise<void> {
    await this.databaseService.query(
      `
        INSERT INTO customers (
          name,
          email,
          status,
          attributes
        )
        SELECT
          'Customer ' || customer_number,
          'customer' || customer_number || '@example.com',
          CASE
            WHEN customer_number % 10 = 0 THEN 'inactive'
            ELSE 'active'
          END,
          jsonb_build_object(
            'source', 'seed',
            'segment', customer_number % 5
          )
        FROM generate_series(
          $1::BIGINT,
          $2::BIGINT
        ) AS generated(customer_number);
      `,
      [start, end],
    );
  }

  private validatePositiveInteger(value: number, name: string): void {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`${name} must be a positive integer`);
    }
  }
}

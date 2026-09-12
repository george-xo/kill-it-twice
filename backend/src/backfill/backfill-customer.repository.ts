import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { BackfillCustomerRow } from './models/backfill-customer-row.model.js';

@Injectable()
export class BackfillCustomerRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findBatch(
    afterId: string,
    snapshotMaxId: string,
    limit: number,
  ): Promise<BackfillCustomerRow[]> {
    const result = await this.databaseService.query<BackfillCustomerRow>(
      `
          SELECT
            customer.id::TEXT AS id,
            customer.name,
            customer.email,
            customer.status,
            customer.attributes,
            customer.version::TEXT AS version,
            customer.created_at,
            customer.updated_at
          FROM customers AS customer
          WHERE customer.id > $1::BIGINT
            AND customer.id <= $2::BIGINT
          ORDER BY customer.id ASC
          LIMIT $3::INTEGER;
        `,
      [afterId, snapshotMaxId, limit],
    );

    return result.rows;
  }
}

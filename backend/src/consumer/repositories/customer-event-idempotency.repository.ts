import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../database/database.service.js';
import type { CustomerChangeEvent } from '../../pipeline/contracts/customer-change-event.contract.js';

@Injectable()
export class CustomerEventIdempotencyRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async recordIfNew(
    consumerName: string,
    event: CustomerChangeEvent,
  ): Promise<boolean> {
    const result = await this.databaseService.query(
      `
        INSERT INTO consumer_processed_events (
          consumer_name,
          event_id,
          entity_type,
          entity_id,
          entity_version,
          operation,
          payload
        )
        VALUES (
          $1,
          $2,
          $3,
          $4::BIGINT,
          $5::BIGINT,
          $6,
          $7::JSONB
        )
        ON CONFLICT (
          consumer_name,
          event_id
        )
        DO NOTHING
        RETURNING event_id;
      `,
      [
        consumerName,
        event.eventId,
        event.entityType,
        event.entityId,
        event.entityVersion,
        event.operation,
        JSON.stringify(event.payload),
      ],
    );

    return result.rowCount === 1;
  }
}

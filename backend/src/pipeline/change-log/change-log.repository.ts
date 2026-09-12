import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import type { ChangeLogRow } from '../models/change-log-row.model.js';

@Injectable()
export class ChangeLogRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findBatchAfterId(
    afterId: string,
    limit: number,
  ): Promise<ChangeLogRow[]> {
    const result = await this.databaseService.query<ChangeLogRow>(
      `
        SELECT
          change_entry.id::TEXT AS id,
          change_entry.entity_id::TEXT AS entity_id,
          change_entry.entity_version::TEXT AS entity_version,
          change_entry.operation,
          change_entry.payload,
          change_entry.created_at
        FROM change_log AS change_entry
        WHERE change_entry.id > $1::BIGINT
        ORDER BY change_entry.id ASC
        LIMIT $2::INTEGER;
      `,
      [afterId, limit],
    );

    return result.rows;
  }
}

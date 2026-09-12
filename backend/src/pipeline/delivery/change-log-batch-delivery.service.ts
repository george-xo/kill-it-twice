import { Injectable } from '@nestjs/common';
import { ChangeLogRepository } from '../change-log/change-log.repository.js';
import { mapChangeLogRowToCustomerChangeEvent } from '../mappers/customer-change-event.mapper.js';
import type { DeliveryBatchResult } from '../models/delivery-batch-result.model.js';
import { CustomerChangeDeliveryService } from './customer-change-delivery.service.js';

@Injectable()
export class ChangeLogBatchDeliveryService {
  constructor(
    private readonly changeLogRepository: ChangeLogRepository,
    private readonly customerChangeDeliveryService: CustomerChangeDeliveryService,
  ) {}

  async deliverBatchAfterId(
    afterId: string,
    limit: number,
  ): Promise<DeliveryBatchResult> {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error('Batch limit must be a positive integer');
    }

    const changeLogRows = await this.changeLogRepository.findBatchAfterId(
      afterId,
      limit,
    );

    let lastProcessedId = afterId;
    let processedCount = 0;

    for (const row of changeLogRows) {
      const event = mapChangeLogRowToCustomerChangeEvent(row);

      await this.customerChangeDeliveryService.deliver(event);

      lastProcessedId = row.id;
      processedCount += 1;
    }

    return {
      processedCount,
      lastProcessedId,
    };
  }
}

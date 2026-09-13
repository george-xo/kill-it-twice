import { Injectable } from '@nestjs/common';

import { ChangeLogRepository } from '../change-log/change-log.repository.js';
import { DestinationDeliveryError } from '../errors/destination-delivery.error.js';
import { mapChangeLogRowToCustomerChangeEvent } from '../mappers/customer-change-event.mapper.js';
import type { DeliveryBatchResult } from '../models/delivery-batch-result.model.js';
import { CustomerChangeDeadLetterService } from './customer-change-dead-letter.service.js';
import { CustomerChangeDeliveryService } from './customer-change-delivery.service.js';

@Injectable()
export class ChangeLogBatchDeliveryService {
  constructor(
    private readonly changeLogRepository: ChangeLogRepository,
    private readonly customerChangeDeliveryService: CustomerChangeDeliveryService,
    private readonly deadLetterService: CustomerChangeDeadLetterService,
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
    let failedCount = 0;

    for (const row of changeLogRows) {
      const event = mapChangeLogRowToCustomerChangeEvent(row);

      try {
        await this.customerChangeDeliveryService.deliver(event);
      } catch (error: unknown) {
        if (!(error instanceof DestinationDeliveryError)) {
          throw error;
        }

        await this.deadLetterService.send(event, error);
        failedCount += 1;
      }

      lastProcessedId = row.id;
      processedCount += 1;
    }

    return {
      processedCount,
      failedCount,
      lastProcessedId,
    };
  }
}

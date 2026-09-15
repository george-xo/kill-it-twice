import { BadRequestException, Injectable } from '@nestjs/common';

import { RabbitMqService } from '../destinations/rabbitmq/rabbitmq.service.js';
import type { DeadLetterReplayResult } from '../pipeline/contracts/dead-letter-replay.contract.js';
import { CustomerChangeDeliveryService } from '../pipeline/delivery/customer-change-delivery.service.js';
import {
  DEFAULT_DEAD_LETTER_REPLAY_LIMIT,
  MAXIMUM_DEAD_LETTER_REPLAY_LIMIT,
} from './dead-letter-replay.constants.js';

@Injectable()
export class DeadLetterReplayService {
  constructor(
    private readonly rabbitMqService: RabbitMqService,
    private readonly customerChangeDeliveryService: CustomerChangeDeliveryService,
  ) {}

  replay(limitValue: string | undefined): Promise<DeadLetterReplayResult> {
    const limit = this.parseLimit(limitValue);

    return this.rabbitMqService.replayFailedCustomerChanges(
      limit,
      async (failedEvent) => {
        await this.customerChangeDeliveryService.deliver(
          failedEvent.originalEvent,
        );
      },
    );
  }

  private parseLimit(value: string | undefined): number {
    if (value === undefined) {
      return DEFAULT_DEAD_LETTER_REPLAY_LIMIT;
    }

    const limit = Number(value);

    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > MAXIMUM_DEAD_LETTER_REPLAY_LIMIT
    ) {
      throw new BadRequestException(
        `Limit must be an integer between 1 and ${MAXIMUM_DEAD_LETTER_REPLAY_LIMIT}`,
      );
    }

    return limit;
  }
}
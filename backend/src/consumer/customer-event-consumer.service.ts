import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { RabbitMqService } from '../destinations/rabbitmq/rabbitmq.service.js';
import type { CustomerChangeEvent } from '../pipeline/contracts/customer-change-event.contract.js';
import { CUSTOMER_EVENT_CONSUMER_NAME } from './customer-event-consumer.constants.js';
import { CustomerEventIdempotencyRepository } from './customer-event-idempotency.repository.js';

@Injectable()
export class CustomerEventConsumerService implements OnModuleInit {
  private readonly logger = new Logger(CustomerEventConsumerService.name);

  constructor(
    private readonly rabbitMqService: RabbitMqService,
    private readonly idempotencyRepository: CustomerEventIdempotencyRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitMqService.consumeCustomerChanges((event) =>
      this.handleCustomerChange(event),
    );

    this.logger.log('Waiting for customer change events');
  }

  private async handleCustomerChange(
    event: CustomerChangeEvent,
  ): Promise<void> {
    const isNewEvent = await this.idempotencyRepository.recordIfNew(
      CUSTOMER_EVENT_CONSUMER_NAME,
      event,
    );

    if (!isNewEvent) {
      this.logger.log(`Duplicate event ignored: ${event.eventId}`);
      return;
    }

    this.logger.log(
      `Processed event ${event.eventId}: ${event.operation} customer ${event.entityId}, version ${event.entityVersion}`,
    );
  }
}

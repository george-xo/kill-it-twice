import { Injectable, Logger } from '@nestjs/common';

import { RabbitMqService } from '../../destinations/rabbitmq/rabbitmq.service.js';
import type { CustomerChangeEvent } from '../contracts/customer-change-event.contract.js';
import type { FailedCustomerChangeEvent } from '../contracts/failed-customer-change-event.contract.js';
import { DestinationDeliveryError } from '../errors/destination-delivery.error.js';

@Injectable()
export class CustomerChangeDeadLetterService {
  private readonly logger = new Logger(CustomerChangeDeadLetterService.name);

  constructor(private readonly rabbitMqService: RabbitMqService) {}

  async send(
    event: CustomerChangeEvent,
    error: DestinationDeliveryError,
  ): Promise<void> {
    const originalErrorMessage =
      error.originalError instanceof Error
        ? error.originalError.message
        : String(error.originalError);

    const failedEvent: FailedCustomerChangeEvent = {
      originalEvent: event,
      failedDestination: error.destination,
      errorMessage: originalErrorMessage,
      failedAt: new Date().toISOString(),
    };

    await this.rabbitMqService.publishFailedCustomerChange(failedEvent);

    this.logger.warn(
      `Event ${event.eventId} sent to DLQ after ${error.destination} delivery failure`,
    );
  }
}

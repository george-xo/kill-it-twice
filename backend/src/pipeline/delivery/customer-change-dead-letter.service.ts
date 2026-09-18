import { Injectable } from '@nestjs/common';

import { RabbitMqService } from '../../destinations/rabbitmq/rabbitmq.service.js';
import { PIPELINE_METRICS } from '../../observability/constants/pipeline-metrics.constants.js';
import { PipelineMetricsService } from '../../observability/services/pipeline-metrics.service.js';
import { StructuredLogger } from '../../observability/structured-logger.js';
import type { CustomerChangeEvent } from '../contracts/customer-change-event.contract.js';
import type { FailedCustomerChangeEvent } from '../contracts/failed-customer-change-event.contract.js';
import { DestinationDeliveryError } from '../errors/destination-delivery.error.js';

@Injectable()
export class CustomerChangeDeadLetterService {
  private readonly logger = new StructuredLogger(
    CustomerChangeDeadLetterService.name,
  );

  constructor(
    private readonly rabbitMqService: RabbitMqService,
    private readonly pipelineMetricsService: PipelineMetricsService,
  ) {}

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

    await this.pipelineMetricsService.increment(
      PIPELINE_METRICS.DEAD_LETTER_EVENTS,
    );

    this.logger.warn('customer_change_sent_to_dlq', {
      eventId: event.eventId,
      entityId: event.entityId,
      version: event.entityVersion,
      operation: event.operation,
      failedDestination: error.destination,
      error: originalErrorMessage,
    });
  }
}

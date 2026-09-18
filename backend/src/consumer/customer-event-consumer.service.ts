import { Injectable, OnModuleInit } from '@nestjs/common';

import { RabbitMqService } from '../destinations/rabbitmq/rabbitmq.service.js';
import { PIPELINE_METRICS } from '../observability/constants/pipeline-metrics.constants.js';
import { PipelineMetricsService } from '../observability/services/pipeline-metrics.service.js';
import { StructuredLogger } from '../observability/structured-logger.js';
import type { CustomerChangeEvent } from '../pipeline/contracts/customer-change-event.contract.js';
import { CUSTOMER_EVENT_CONSUMER_NAME } from './constants/customer-event-consumer.constants.js';
import { CustomerEventIdempotencyRepository } from './repositories/customer-event-idempotency.repository.js';

@Injectable()
export class CustomerEventConsumerService implements OnModuleInit {
  private readonly logger = new StructuredLogger(
    CustomerEventConsumerService.name,
  );

  constructor(
    private readonly rabbitMqService: RabbitMqService,
    private readonly idempotencyRepository: CustomerEventIdempotencyRepository,
    private readonly pipelineMetricsService: PipelineMetricsService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitMqService.consumeCustomerChanges((event) =>
      this.handleCustomerChange(event),
    );

    this.logger.log('consumer_waiting_for_events', {
      consumerName: CUSTOMER_EVENT_CONSUMER_NAME,
    });
  }

  private async handleCustomerChange(
    event: CustomerChangeEvent,
  ): Promise<void> {
    const isNewEvent = await this.idempotencyRepository.recordIfNew(
      CUSTOMER_EVENT_CONSUMER_NAME,
      event,
    );

    if (!isNewEvent) {
      await this.pipelineMetricsService.increment(
        PIPELINE_METRICS.CONSUMER_DUPLICATE_EVENTS,
      );

      this.logger.log('consumer_duplicate_event_ignored', {
        consumerName: CUSTOMER_EVENT_CONSUMER_NAME,
        eventId: event.eventId,
        entityId: event.entityId,
        version: event.entityVersion,
        operation: event.operation,
      });

      return;
    }

    await this.pipelineMetricsService.increment(
      PIPELINE_METRICS.CONSUMER_PROCESSED_EVENTS,
    );

    this.logger.log('consumer_event_processed', {
      consumerName: CUSTOMER_EVENT_CONSUMER_NAME,
      eventId: event.eventId,
      entityId: event.entityId,
      version: event.entityVersion,
      operation: event.operation,
    });
  }
}

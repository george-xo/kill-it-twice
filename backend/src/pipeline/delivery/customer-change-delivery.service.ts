import { Injectable } from '@nestjs/common';

import { ElasticsearchService } from '../../destinations/elasticsearch/elasticsearch.service.js';
import { RabbitMqService } from '../../destinations/rabbitmq/rabbitmq.service.js';
import { DestinationRetryService } from '../../resilience/destination-retry.service.js';
import type { CustomerChangeEvent } from '../contracts/customer-change-event.contract.js';
import { DestinationDeliveryError } from '../errors/destination-delivery.error.js';

@Injectable()
export class CustomerChangeDeliveryService {
  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private readonly rabbitMqService: RabbitMqService,
    private readonly destinationRetryService: DestinationRetryService,
  ) {}

  async deliver(event: CustomerChangeEvent): Promise<void> {
    try {
      await this.destinationRetryService.execute(
        `Elasticsearch delivery for ${event.eventId}`,
        () => this.deliverToElasticsearch(event),
      );
    } catch (error: unknown) {
      throw new DestinationDeliveryError('elasticsearch', error);
    }

    try {
      await this.destinationRetryService.execute(
        `RabbitMQ delivery for ${event.eventId}`,
        () => this.rabbitMqService.publishCustomerChange(event),
      );
    } catch (error: unknown) {
      throw new DestinationDeliveryError('rabbitmq', error);
    }
  }

  private async deliverToElasticsearch(
    event: CustomerChangeEvent,
  ): Promise<void> {
    if (event.operation === 'DELETE') {
      await this.elasticsearchService.deleteCustomer(event);
      return;
    }

    await this.elasticsearchService.indexCustomer(event);
  }
}

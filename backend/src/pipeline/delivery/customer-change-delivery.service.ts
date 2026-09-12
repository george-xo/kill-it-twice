import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '../../destinations/elasticsearch/elasticsearch.service.js';
import { RabbitMqService } from '../../destinations/rabbitmq/rabbitmq.service.js';
import type { CustomerChangeEvent } from '../contracts/customer-change-event.contract.js';

@Injectable()
export class CustomerChangeDeliveryService {
  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private readonly rabbitMqService: RabbitMqService,
  ) {}

  async deliver(event: CustomerChangeEvent): Promise<void> {
    await Promise.all([
      this.deliverToElasticsearch(event),
      this.rabbitMqService.publishCustomerChange(event),
    ]);
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

import { Injectable } from '@nestjs/common';

import { ElasticsearchService } from '../../destinations/elasticsearch/elasticsearch.service.js';
import { RabbitMqService } from '../../destinations/rabbitmq/rabbitmq.service.js';
import { PIPELINE_METRICS } from '../../observability/constants/pipeline-metrics.constants.js';
import { PipelineMetricsService } from '../../observability/services/pipeline-metrics.service.js';
import { DestinationRetryService } from '../../resilience/destination-retry.service.js';
import { SimulationService } from '../../simulation/simulation.service.js';
import type { CustomerChangeEvent } from '../contracts/customer-change-event.contract.js';
import { DestinationDeliveryError } from '../errors/destination-delivery.error.js';

@Injectable()
export class CustomerChangeDeliveryService {
  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private readonly rabbitMqService: RabbitMqService,
    private readonly destinationRetryService: DestinationRetryService,
    private readonly pipelineMetricsService: PipelineMetricsService,
    private readonly simulationService: SimulationService,
  ) {}

  async deliver(event: CustomerChangeEvent): Promise<void> {
    try {
      await this.destinationRetryService.execute(
        `Elasticsearch delivery for ${event.eventId}`,
        PIPELINE_METRICS.ELASTICSEARCH_RETRIES,
        async () => {
          await this.simulationService.assertDestinationAvailable(
            'elasticsearch',
          );

          await this.deliverToElasticsearch(event);
        },
        {
          eventId: event.eventId,
          entityId: event.entityId,
          version: event.entityVersion,
          destination: 'elasticsearch',
        },
      );
    } catch (error: unknown) {
      throw new DestinationDeliveryError('elasticsearch', error);
    }

    try {
      await this.destinationRetryService.execute(
        `RabbitMQ delivery for ${event.eventId}`,
        PIPELINE_METRICS.RABBITMQ_RETRIES,
        async () => {
          await this.simulationService.assertDestinationAvailable('rabbitmq');

          await this.rabbitMqService.publishCustomerChange(event);
        },
        {
          eventId: event.eventId,
          entityId: event.entityId,
          version: event.entityVersion,
          destination: 'rabbitmq',
        },
      );
    } catch (error: unknown) {
      throw new DestinationDeliveryError('rabbitmq', error);
    }

    await this.pipelineMetricsService.increment(
      PIPELINE_METRICS.DELIVERED_EVENTS,
    );
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

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DestinationSetupModule } from './destination-setup.module.js';
import { ElasticsearchService } from './elasticsearch/elasticsearch.service.js';
import { RabbitMqService } from './rabbitmq/rabbitmq.service.js';

const DESTINATION_SETUP_LOG_CONTEXT = 'DestinationSetup';
const logger = new Logger(DESTINATION_SETUP_LOG_CONTEXT);

async function setupDestinations(): Promise<void> {
  const application = await NestFactory.createApplicationContext(
    DestinationSetupModule,
  );

  try {
    const elasticsearchService = application.get(ElasticsearchService);
    const rabbitMqService = application.get(RabbitMqService);

    const elasticsearchAvailable = await elasticsearchService.isAvailable();

    if (!elasticsearchAvailable) {
      throw new Error('Elasticsearch is not available');
    }

    await elasticsearchService.ensureCustomerIndex();

    logger.log('Elasticsearch customers index is ready');

    const rabbitMqAvailable = await rabbitMqService.isAvailable();

    if (!rabbitMqAvailable) {
      throw new Error('RabbitMQ is not available');
    }

    await rabbitMqService.ensureTopology();

    logger.log('RabbitMQ customer events topology is ready');
  } finally {
    await application.close();
  }
}

setupDestinations().catch((error: unknown) => {
  const errorMessage = error instanceof Error ? error.stack : String(error);

  logger.error(errorMessage);
  process.exitCode = 1;
});

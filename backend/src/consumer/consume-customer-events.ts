import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { CustomerEventConsumerModule } from './customer-event-consumer.module.js';

const CONSUMER_LOG_CONTEXT = 'CustomerEventConsumer';
const logger = new Logger(CONSUMER_LOG_CONTEXT);

async function consumeCustomerEvents(): Promise<void> {
  const application = await NestFactory.createApplicationContext(
    CustomerEventConsumerModule,
  );

  application.enableShutdownHooks();

  logger.log('Customer event consumer started');
}

consumeCustomerEvents().catch((error: unknown) => {
  const errorMessage = error instanceof Error ? error.stack : String(error);

  logger.error(errorMessage);
  process.exitCode = 1;
});

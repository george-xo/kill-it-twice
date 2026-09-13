import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ChangeLogBatchDeliveryService } from './delivery/change-log-batch-delivery.service.js';
import { PipelineRunnerModule } from './pipeline-runner.module.js';

const DELIVERY_LOG_CONTEXT = 'ChangeDelivery';
const DEFAULT_AFTER_ID = '0';
const DEFAULT_BATCH_SIZE = 100;

const logger = new Logger(DELIVERY_LOG_CONTEXT);

async function deliverChanges(): Promise<void> {
  const application =
    await NestFactory.createApplicationContext(PipelineRunnerModule);

  try {
    const configService = application.get(ConfigService);
    const batchDeliveryService = application.get(ChangeLogBatchDeliveryService);

    const afterId = configService.get<string>(
      'DELIVERY_AFTER_ID',
      DEFAULT_AFTER_ID,
    );

    const batchSize = Number(
      configService.get<string>(
        'DELIVERY_BATCH_SIZE',
        String(DEFAULT_BATCH_SIZE),
      ),
    );

    const result = await batchDeliveryService.deliverBatchAfterId(
      afterId,
      batchSize,
    );

    logger.log(
      `Processed ${result.processedCount} changes; failed: ${result.failedCount}; last processed ID: ${result.lastProcessedId}`,
    );
  } finally {
    await application.close();
  }
}

deliverChanges().catch((error: unknown) => {
  const errorMessage = error instanceof Error ? error.stack : String(error);

  logger.error(errorMessage);
  process.exitCode = 1;
});

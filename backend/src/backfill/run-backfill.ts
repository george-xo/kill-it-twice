import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { BackfillRunnerModule } from './backfill-runner.module.js';
import { BackfillService } from './backfill.service.js';

const BACKFILL_LOG_CONTEXT = 'BackfillRunner';
const logger = new Logger(BACKFILL_LOG_CONTEXT);

async function runBackfill(): Promise<void> {
  const application =
    await NestFactory.createApplicationContext(BackfillRunnerModule);

  try {
    const backfillService = application.get(BackfillService);

    await backfillService.run();
  } finally {
    await application.close();
  }
}

runBackfill().catch((error: unknown) => {
  const errorMessage = error instanceof Error ? error.stack : String(error);

  logger.error(errorMessage);
  process.exitCode = 1;
});

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { IncrementalSyncRunnerModule } from './incremental-sync-runner.module.js';
import { IncrementalSyncService } from './incremental-sync.service.js';

const INCREMENTAL_SYNC_LOG_CONTEXT = 'IncrementalSyncRunner';
const logger = new Logger(INCREMENTAL_SYNC_LOG_CONTEXT);

async function runIncrementalSync(): Promise<void> {
  const application = await NestFactory.createApplicationContext(
    IncrementalSyncRunnerModule,
  );

  const incrementalSyncService = application.get(IncrementalSyncService);

  const requestStop = (): void => {
    logger.log('Incremental Sync shutdown requested');
    incrementalSyncService.requestStop();
  };

  process.once('SIGINT', requestStop);
  process.once('SIGTERM', requestStop);

  try {
    await incrementalSyncService.run();
  } finally {
    process.off('SIGINT', requestStop);
    process.off('SIGTERM', requestStop);

    await application.close();
  }
}

runIncrementalSync().catch((error: unknown) => {
  const errorMessage = error instanceof Error ? error.stack : String(error);

  logger.error(errorMessage);
  process.exitCode = 1;
});

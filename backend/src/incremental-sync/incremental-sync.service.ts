import { setTimeout as delay } from 'node:timers/promises';

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BackfillJobRepository } from '../backfill/backfill-job.repository.js';
import { CUSTOMER_BACKFILL_JOB_NAME } from '../backfill/backfill.constants.js';
import { ChangeLogBatchDeliveryService } from '../pipeline/delivery/change-log-batch-delivery.service.js';
import {
  CUSTOMER_INCREMENTAL_SYNC_JOB_NAME,
  DEFAULT_INCREMENTAL_SYNC_BATCH_SIZE,
  DEFAULT_INCREMENTAL_SYNC_POLL_INTERVAL_MS,
  INCREMENTAL_SYNC_BATCH_SIZE_CONFIG_KEY,
  INCREMENTAL_SYNC_POLL_INTERVAL_MS_CONFIG_KEY,
} from './incremental-sync.constants.js';
import { IncrementalSyncJobRepository } from './incremental-sync-job.repository.js';

@Injectable()
export class IncrementalSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IncrementalSyncService.name);

  private batchSize = DEFAULT_INCREMENTAL_SYNC_BATCH_SIZE;
  private pollIntervalMs = DEFAULT_INCREMENTAL_SYNC_POLL_INTERVAL_MS;
  private stopRequested = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly backfillJobRepository: BackfillJobRepository,
    private readonly incrementalSyncJobRepository: IncrementalSyncJobRepository,
    private readonly batchDeliveryService: ChangeLogBatchDeliveryService,
  ) {}

  onModuleInit(): void {
    this.batchSize = Number(
      this.configService.get<string>(
        INCREMENTAL_SYNC_BATCH_SIZE_CONFIG_KEY,
        String(DEFAULT_INCREMENTAL_SYNC_BATCH_SIZE),
      ),
    );

    this.pollIntervalMs = Number(
      this.configService.get<string>(
        INCREMENTAL_SYNC_POLL_INTERVAL_MS_CONFIG_KEY,
        String(DEFAULT_INCREMENTAL_SYNC_POLL_INTERVAL_MS),
      ),
    );

    if (!Number.isInteger(this.batchSize) || this.batchSize < 1) {
      throw new Error(
        `${INCREMENTAL_SYNC_BATCH_SIZE_CONFIG_KEY} must be a positive integer`,
      );
    }

    if (!Number.isInteger(this.pollIntervalMs) || this.pollIntervalMs < 1) {
      throw new Error(
        `${INCREMENTAL_SYNC_POLL_INTERVAL_MS_CONFIG_KEY} must be a positive integer`,
      );
    }
  }

  async run(): Promise<void> {
    const backfillJob = await this.backfillJobRepository.getOrCreate(
      CUSTOMER_BACKFILL_JOB_NAME,
    );

    const incrementalSyncJob =
      await this.incrementalSyncJobRepository.getOrCreate(
        CUSTOMER_INCREMENTAL_SYNC_JOB_NAME,
        backfillJob.incremental_start_change_id,
      );

    await this.incrementalSyncJobRepository.markRunning(
      CUSTOMER_INCREMENTAL_SYNC_JOB_NAME,
    );

    this.logger.log(
      `Incremental Sync started after change ID ${incrementalSyncJob.last_processed_change_id}`,
    );

    try {
      await this.processChanges(incrementalSyncJob.last_processed_change_id);

      await this.incrementalSyncJobRepository.markStopped(
        CUSTOMER_INCREMENTAL_SYNC_JOB_NAME,
      );

      this.logger.log('Incremental Sync stopped');
    } catch (error: unknown) {
      await this.incrementalSyncJobRepository.markFailed(
        CUSTOMER_INCREMENTAL_SYNC_JOB_NAME,
        error,
      );

      throw error;
    }
  }

  requestStop(): void {
    this.stopRequested = true;
  }

  onModuleDestroy(): void {
    this.requestStop();
  }

  private async processChanges(
    initialLastProcessedChangeId: string,
  ): Promise<void> {
    let lastProcessedChangeId = initialLastProcessedChangeId;

    while (!this.stopRequested) {
      const result = await this.batchDeliveryService.deliverBatchAfterId(
        lastProcessedChangeId,
        this.batchSize,
      );

      if (result.processedCount === 0) {
        await delay(this.pollIntervalMs);
        continue;
      }

      await this.incrementalSyncJobRepository.saveCheckpoint(
        CUSTOMER_INCREMENTAL_SYNC_JOB_NAME,
        result.lastProcessedId,
        result.processedCount,
      );

      lastProcessedChangeId = result.lastProcessedId;

      this.logger.log(
        `Incremental Sync checkpoint saved at change ID ${lastProcessedChangeId}`,
      );
    }
  }
}

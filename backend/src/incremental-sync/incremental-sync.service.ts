import { setTimeout as delay } from 'node:timers/promises';

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CUSTOMER_BACKFILL_JOB_NAME } from '../backfill/constants/backfill.constants.js';
import { BackfillJobRepository } from '../backfill/repositories/backfill-job.repository.js';
import { DatabaseService } from '../database/database.service.js';
import { ChangeLogBatchDeliveryService } from '../pipeline/delivery/change-log-batch-delivery.service.js';
import {
  CUSTOMER_INCREMENTAL_SYNC_JOB_NAME,
  DEFAULT_INCREMENTAL_SYNC_BATCH_SIZE,
  DEFAULT_INCREMENTAL_SYNC_POLL_INTERVAL_MS,
  INCREMENTAL_SYNC_BATCH_SIZE_CONFIG_KEY,
  INCREMENTAL_SYNC_POLL_INTERVAL_MS_CONFIG_KEY,
} from './incremental-sync.constants.js';
import { IncrementalSyncJobRepository } from './incremental-sync-job.repository.js';

const INCREMENTAL_SYNC_CONTROL_POLL_INTERVAL_MS = 250;

const INCREMENTAL_SYNC_ADVISORY_LOCK_NAME = `incremental-sync:${CUSTOMER_INCREMENTAL_SYNC_JOB_NAME}`;

@Injectable()
export class IncrementalSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IncrementalSyncService.name);

  private batchSize = DEFAULT_INCREMENTAL_SYNC_BATCH_SIZE;

  private pollIntervalMs = DEFAULT_INCREMENTAL_SYNC_POLL_INTERVAL_MS;

  private shutdownRequested = false;
  private running = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
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
    if (this.running) {
      this.logger.log('Incremental Sync is already running in this process');

      return;
    }

    this.running = true;
    this.shutdownRequested = false;

    try {
      const lockAcquired = await this.databaseService.tryWithAdvisoryLock(
        INCREMENTAL_SYNC_ADVISORY_LOCK_NAME,
        () => this.executeIncrementalSync(),
      );

      if (!lockAcquired) {
        this.logger.log(
          'Incremental Sync is already controlled by another process',
        );
      }
    } finally {
      this.running = false;
    }
  }

  requestStop(): void {
    this.shutdownRequested = true;
  }

  onModuleDestroy(): void {
    this.requestStop();
  }

  private async executeIncrementalSync(): Promise<void> {
    const backfillJob = await this.backfillJobRepository.getOrCreate(
      CUSTOMER_BACKFILL_JOB_NAME,
    );

    const incrementalSyncJob =
      await this.incrementalSyncJobRepository.getOrCreate(
        CUSTOMER_INCREMENTAL_SYNC_JOB_NAME,
        backfillJob.incremental_start_change_id,
      );

    const stopRequested =
      await this.incrementalSyncJobRepository.isStopRequested(
        CUSTOMER_INCREMENTAL_SYNC_JOB_NAME,
      );

    if (stopRequested) {
      await this.incrementalSyncJobRepository.markStopped(
        CUSTOMER_INCREMENTAL_SYNC_JOB_NAME,
      );
    } else {
      await this.incrementalSyncJobRepository.markRunning(
        CUSTOMER_INCREMENTAL_SYNC_JOB_NAME,
      );
    }

    this.logger.log(
      `Incremental Sync started after change ID ${incrementalSyncJob.last_processed_change_id}`,
    );

    try {
      await this.processChanges(
        incrementalSyncJob.last_processed_change_id,
        stopRequested,
      );

      await this.incrementalSyncJobRepository.markStopped(
        CUSTOMER_INCREMENTAL_SYNC_JOB_NAME,
      );

      this.logger.log('Incremental Sync stopped during application shutdown');
    } catch (error: unknown) {
      await this.incrementalSyncJobRepository.markFailed(
        CUSTOMER_INCREMENTAL_SYNC_JOB_NAME,
        error,
      );

      throw error;
    }
  }

  private async processChanges(
    initialLastProcessedChangeId: string,
    initiallyPaused: boolean,
  ): Promise<void> {
    let lastProcessedChangeId = initialLastProcessedChangeId;
    let paused = initiallyPaused;

    while (!this.shutdownRequested) {
      const stopRequested =
        await this.incrementalSyncJobRepository.isStopRequested(
          CUSTOMER_INCREMENTAL_SYNC_JOB_NAME,
        );

      if (stopRequested) {
        if (!paused) {
          await this.incrementalSyncJobRepository.markStopped(
            CUSTOMER_INCREMENTAL_SYNC_JOB_NAME,
          );

          this.logger.log('Incremental Sync paused by control request');

          paused = true;
        }

        await delay(INCREMENTAL_SYNC_CONTROL_POLL_INTERVAL_MS);
        continue;
      }

      if (paused) {
        await this.incrementalSyncJobRepository.markRunning(
          CUSTOMER_INCREMENTAL_SYNC_JOB_NAME,
        );

        this.logger.log('Incremental Sync resumed by control request');

        paused = false;
      }

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

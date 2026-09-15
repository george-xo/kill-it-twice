import { setTimeout as delay } from 'node:timers/promises';

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CustomerChangeDeliveryService } from '../pipeline/delivery/customer-change-delivery.service.js';
import {
  BACKFILL_BATCH_DELAY_MS_CONFIG_KEY,
  BACKFILL_BATCH_SIZE_CONFIG_KEY,
  CUSTOMER_BACKFILL_JOB_NAME,
  DEFAULT_BACKFILL_BATCH_DELAY_MS,
  DEFAULT_BACKFILL_BATCH_SIZE,
} from './backfill.constants.js';
import { BackfillCustomerRepository } from './backfill-customer.repository.js';
import { BackfillJobRepository } from './backfill-job.repository.js';
import { mapBackfillCustomerToEvent } from './mappers/backfill-customer-event.mapper.js';

const BACKFILL_CONTROL_POLL_INTERVAL_MS = 250;

@Injectable()
export class BackfillService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackfillService.name);

  private batchSize = DEFAULT_BACKFILL_BATCH_SIZE;
  private batchDelayMs = DEFAULT_BACKFILL_BATCH_DELAY_MS;

  private shutdownRequested = false;
  private running = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly backfillJobRepository: BackfillJobRepository,
    private readonly backfillCustomerRepository: BackfillCustomerRepository,
    private readonly customerChangeDeliveryService: CustomerChangeDeliveryService,
  ) {}

  onModuleInit(): void {
    this.batchSize = Number(
      this.configService.get<string>(
        BACKFILL_BATCH_SIZE_CONFIG_KEY,
        String(DEFAULT_BACKFILL_BATCH_SIZE),
      ),
    );

    this.batchDelayMs = Number(
      this.configService.get<string>(
        BACKFILL_BATCH_DELAY_MS_CONFIG_KEY,
        String(DEFAULT_BACKFILL_BATCH_DELAY_MS),
      ),
    );

    if (!Number.isInteger(this.batchSize) || this.batchSize < 1) {
      throw new Error(
        `${BACKFILL_BATCH_SIZE_CONFIG_KEY} must be a positive integer`,
      );
    }

    if (!Number.isInteger(this.batchDelayMs) || this.batchDelayMs < 0) {
      throw new Error(
        `${BACKFILL_BATCH_DELAY_MS_CONFIG_KEY} must be a non-negative integer`,
      );
    }
  }

  async run(): Promise<void> {
    if (this.running) {
      throw new Error('Backfill is already running');
    }

    this.running = true;
    this.shutdownRequested = false;

    try {
      await this.executeBackfill();
    } finally {
      this.running = false;
    }
  }

  requestStop(): void {
    this.shutdownRequested = true;
  }

  isRunning(): boolean {
    return this.running;
  }

  onModuleDestroy(): void {
    this.requestStop();
  }

  private async executeBackfill(): Promise<void> {
    const job = await this.backfillJobRepository.getOrCreate(
      CUSTOMER_BACKFILL_JOB_NAME,
    );

    if (job.status === 'completed') {
      this.logger.log(
        `Backfill job "${CUSTOMER_BACKFILL_JOB_NAME}" is already completed`,
      );

      return;
    }

    await this.backfillJobRepository.markRunning(CUSTOMER_BACKFILL_JOB_NAME);

    this.logger.log(
      `Backfill started from customer ID ${job.last_processed_id}; snapshot max ID: ${job.snapshot_max_id}`,
    );

    try {
      const completed = await this.processBatches(
        job.last_processed_id,
        job.snapshot_max_id,
      );

      if (completed) {
        await this.backfillJobRepository.markCompleted(
          CUSTOMER_BACKFILL_JOB_NAME,
        );

        this.logger.log(
          `Backfill completed at snapshot max ID ${job.snapshot_max_id}`,
        );

        return;
      }

      await this.backfillJobRepository.markStopped(CUSTOMER_BACKFILL_JOB_NAME);

      this.logger.log('Backfill stopped during application shutdown');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await this.backfillJobRepository.markFailed(
        CUSTOMER_BACKFILL_JOB_NAME,
        errorMessage,
      );

      throw error;
    }
  }

  private async processBatches(
    initialLastProcessedId: string,
    snapshotMaxId: string,
  ): Promise<boolean> {
    let lastProcessedId = initialLastProcessedId;
    let paused = false;

    while (!this.shutdownRequested) {
      const stopRequested = await this.backfillJobRepository.isStopRequested(
        CUSTOMER_BACKFILL_JOB_NAME,
      );

      if (stopRequested) {
        if (!paused) {
          await this.backfillJobRepository.markStopped(
            CUSTOMER_BACKFILL_JOB_NAME,
          );

          this.logger.log('Backfill paused by control request');
          paused = true;
        }

        await delay(BACKFILL_CONTROL_POLL_INTERVAL_MS);
        continue;
      }

      if (paused) {
        await this.backfillJobRepository.markRunning(
          CUSTOMER_BACKFILL_JOB_NAME,
        );

        this.logger.log('Backfill resumed by control request');
        paused = false;
      }

      const customers = await this.backfillCustomerRepository.findBatch(
        lastProcessedId,
        snapshotMaxId,
        this.batchSize,
      );

      if (customers.length === 0) {
        return true;
      }

      for (const customer of customers) {
        const event = mapBackfillCustomerToEvent(customer);

        await this.customerChangeDeliveryService.deliver(event);
      }

      const lastCustomer = customers.at(-1);

      if (!lastCustomer) {
        throw new Error('Backfill batch has no last customer');
      }

      await this.backfillJobRepository.saveCheckpoint(
        CUSTOMER_BACKFILL_JOB_NAME,
        lastCustomer.id,
        customers.length,
      );

      lastProcessedId = lastCustomer.id;

      this.logger.log(
        `Backfill checkpoint saved at customer ID ${lastProcessedId}`,
      );

      if (this.batchDelayMs > 0) {
        await delay(this.batchDelayMs);
      }
    }

    return false;
  }
}

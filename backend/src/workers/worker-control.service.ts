import { setTimeout as delay } from 'node:timers/promises';

import { ConflictException, Injectable, Logger } from '@nestjs/common';

import { BackfillJobRepository } from '../backfill/backfill-job.repository.js';
import { BackfillService } from '../backfill/backfill.service.js';
import { CUSTOMER_BACKFILL_JOB_NAME } from '../backfill/backfill.constants.js';
import { IncrementalSyncJobRepository } from '../incremental-sync/incremental-sync-job.repository.js';
import { CUSTOMER_INCREMENTAL_SYNC_JOB_NAME } from '../incremental-sync/incremental-sync.constants.js';
import type { WorkerCommandResponse } from './models/worker-command-response.model.js';

const BACKFILL_START_WAIT_MS = 500;

@Injectable()
export class WorkerControlService {
  private readonly logger = new Logger(WorkerControlService.name);

  constructor(
    private readonly backfillJobRepository: BackfillJobRepository,
    private readonly backfillService: BackfillService,
    private readonly incrementalSyncJobRepository: IncrementalSyncJobRepository,
  ) {}

  async startBackfill(): Promise<WorkerCommandResponse> {
    const job = await this.backfillJobRepository.getOrCreate(
      CUSTOMER_BACKFILL_JOB_NAME,
    );

    if (job.status === 'completed') {
      throw new ConflictException(
        'Backfill is already completed and cannot be resumed',
      );
    }

    await this.backfillJobRepository.requestStart(CUSTOMER_BACKFILL_JOB_NAME);

    await delay(BACKFILL_START_WAIT_MS);

    const currentJob = await this.backfillJobRepository.getOrCreate(
      CUSTOMER_BACKFILL_JOB_NAME,
    );

    if (currentJob.status !== 'running' && !this.backfillService.isRunning()) {
      void this.runBackfill();
    }

    return this.createResponse('backfill', 'running');
  }

  async stopBackfill(): Promise<WorkerCommandResponse> {
    await this.backfillJobRepository.getOrCreate(CUSTOMER_BACKFILL_JOB_NAME);

    await this.backfillJobRepository.requestStop(CUSTOMER_BACKFILL_JOB_NAME);

    return this.createResponse('backfill', 'stopped');
  }

  async startIncrementalSync(): Promise<WorkerCommandResponse> {
    await this.ensureIncrementalSyncJob();

    await this.incrementalSyncJobRepository.requestStart(
      CUSTOMER_INCREMENTAL_SYNC_JOB_NAME,
    );

    return this.createResponse('incrementalSync', 'running');
  }

  async stopIncrementalSync(): Promise<WorkerCommandResponse> {
    await this.ensureIncrementalSyncJob();

    await this.incrementalSyncJobRepository.requestStop(
      CUSTOMER_INCREMENTAL_SYNC_JOB_NAME,
    );

    return this.createResponse('incrementalSync', 'stopped');
  }

  private async runBackfill(): Promise<void> {
    try {
      await this.backfillService.run();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.stack : String(error);

      this.logger.error(`Backfill execution failed: ${errorMessage}`);
    }
  }

  private async ensureIncrementalSyncJob(): Promise<void> {
    const backfillJob = await this.backfillJobRepository.getOrCreate(
      CUSTOMER_BACKFILL_JOB_NAME,
    );

    await this.incrementalSyncJobRepository.getOrCreate(
      CUSTOMER_INCREMENTAL_SYNC_JOB_NAME,
      backfillJob.incremental_start_change_id,
    );
  }

  private createResponse(
    worker: WorkerCommandResponse['worker'],
    requestedState: WorkerCommandResponse['requestedState'],
  ): WorkerCommandResponse {
    return {
      worker,
      requestedState,
      acceptedAt: new Date().toISOString(),
    };
  }
}

import { ConflictException, Injectable, Logger } from '@nestjs/common';

import { CUSTOMER_BACKFILL_JOB_NAME } from '../backfill/constants/backfill.constants.js';
import { BackfillJobRepository } from '../backfill/repositories/backfill-job.repository.js';
import { BackfillService } from '../backfill/backfill.service.js';
import { CUSTOMER_INCREMENTAL_SYNC_JOB_NAME } from '../incremental-sync/incremental-sync.constants.js';
import { IncrementalSyncJobRepository } from '../incremental-sync/incremental-sync-job.repository.js';
import { IncrementalSyncService } from '../incremental-sync/incremental-sync.service.js';
import {
  type WorkerCommandResponse,
  WORKER_NAMES,
  WORKER_STATES,
} from './models/worker-command-response.model.js';

@Injectable()
export class WorkerControlService {
  private readonly logger = new Logger(WorkerControlService.name);

  constructor(
    private readonly backfillJobRepository: BackfillJobRepository,
    private readonly backfillService: BackfillService,
    private readonly incrementalSyncJobRepository: IncrementalSyncJobRepository,
    private readonly incrementalSyncService: IncrementalSyncService,
  ) {}

  async startBackfill(): Promise<WorkerCommandResponse> {
    const job = await this.backfillJobRepository.getOrCreate(
      CUSTOMER_BACKFILL_JOB_NAME,
    );

    if (job.status === WORKER_STATES.COMPLETED) {
      throw new ConflictException(
        'Backfill is already completed and cannot be resumed',
      );
    }

    await this.backfillJobRepository.requestStart(CUSTOMER_BACKFILL_JOB_NAME);

    void this.runBackfill();

    return this.createResponse(WORKER_NAMES.BACKFILL, WORKER_STATES.RUNNING);
  }

  async stopBackfill(): Promise<WorkerCommandResponse> {
    await this.backfillJobRepository.getOrCreate(CUSTOMER_BACKFILL_JOB_NAME);

    await this.backfillJobRepository.requestStop(CUSTOMER_BACKFILL_JOB_NAME);

    return this.createResponse(WORKER_NAMES.BACKFILL, WORKER_STATES.STOPPED);
  }

  async startIncrementalSync(): Promise<WorkerCommandResponse> {
    await this.ensureIncrementalSyncJob();

    await this.incrementalSyncJobRepository.requestStart(
      CUSTOMER_INCREMENTAL_SYNC_JOB_NAME,
    );

    void this.runIncrementalSync();

    return this.createResponse(
      WORKER_NAMES.INCREMENTAL_SYNC,
      WORKER_STATES.RUNNING,
    );
  }

  async stopIncrementalSync(): Promise<WorkerCommandResponse> {
    await this.ensureIncrementalSyncJob();

    await this.incrementalSyncJobRepository.requestStop(
      CUSTOMER_INCREMENTAL_SYNC_JOB_NAME,
    );

    return this.createResponse(
      WORKER_NAMES.INCREMENTAL_SYNC,
      WORKER_STATES.STOPPED,
    );
  }

  private async runBackfill(): Promise<void> {
    try {
      await this.backfillService.run();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.stack : String(error);

      this.logger.error(`Backfill execution failed: ${errorMessage}`);
    }
  }

  private async runIncrementalSync(): Promise<void> {
    try {
      await this.incrementalSyncService.run();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.stack : String(error);

      this.logger.error(`Incremental Sync execution failed: ${errorMessage}`);
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

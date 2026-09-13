import { Module } from '@nestjs/common';

import { BackfillModule } from '../backfill/backfill.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { PipelineModule } from '../pipeline/pipeline.module.js';
import { IncrementalSyncJobRepository } from './incremental-sync-job.repository.js';
import { IncrementalSyncService } from './incremental-sync.service.js';

@Module({
  imports: [DatabaseModule, BackfillModule, PipelineModule],
  providers: [IncrementalSyncJobRepository, IncrementalSyncService],
  exports: [IncrementalSyncService],
})
export class IncrementalSyncModule {}

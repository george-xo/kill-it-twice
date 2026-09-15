import { Module } from '@nestjs/common';

import { BackfillModule } from '../backfill/backfill.module.js';
import { IncrementalSyncModule } from '../incremental-sync/incremental-sync.module.js';
import { WorkerControlController } from './worker-control.controller.js';
import { WorkerControlService } from './worker-control.service.js';

@Module({
  imports: [BackfillModule, IncrementalSyncModule],
  controllers: [WorkerControlController],
  providers: [WorkerControlService],
})
export class WorkerControlModule {}

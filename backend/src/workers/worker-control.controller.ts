import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';

import type { WorkerCommandResponse } from './models/worker-command-response.model.js';
import { WorkerControlService } from './worker-control.service.js';

@Controller('workers')
export class WorkerControlController {
  constructor(private readonly workerControlService: WorkerControlService) {}

  @Post('backfill/start')
  @HttpCode(HttpStatus.ACCEPTED)
  startBackfill(): Promise<WorkerCommandResponse> {
    return this.workerControlService.startBackfill();
  }

  @Post('backfill/stop')
  @HttpCode(HttpStatus.ACCEPTED)
  stopBackfill(): Promise<WorkerCommandResponse> {
    return this.workerControlService.stopBackfill();
  }

  @Post('incremental-sync/start')
  @HttpCode(HttpStatus.ACCEPTED)
  startIncrementalSync(): Promise<WorkerCommandResponse> {
    return this.workerControlService.startIncrementalSync();
  }

  @Post('incremental-sync/stop')
  @HttpCode(HttpStatus.ACCEPTED)
  stopIncrementalSync(): Promise<WorkerCommandResponse> {
    return this.workerControlService.stopIncrementalSync();
  }
}

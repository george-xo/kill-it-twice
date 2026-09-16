import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { PipelineModule } from '../pipeline/pipeline.module.js';
import { BackfillCustomerRepository } from './repositories/backfill-customer.repository.js';
import { BackfillJobRepository } from './repositories/backfill-job.repository.js';
import { BackfillService } from './backfill.service.js';

@Module({
  imports: [DatabaseModule, PipelineModule],
  providers: [
    BackfillJobRepository,
    BackfillCustomerRepository,
    BackfillService,
  ],
  exports: [BackfillJobRepository, BackfillService],
})
export class BackfillModule {}

import { Module } from '@nestjs/common';

import { DestinationRetryService } from './destination-retry.service.js';
import { PipelineMetricsModule } from '../observability/pipeline-metrics.module.js';
@Module({
  imports: [PipelineMetricsModule],
  providers: [DestinationRetryService],
  exports: [DestinationRetryService],
})
export class ResilienceModule {}

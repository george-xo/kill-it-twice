import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { PipelineMetricsRepository } from './repositories/pipeline-metrics.repository.js';
import { PipelineMetricsService } from './services/pipeline-metrics.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [PipelineMetricsRepository, PipelineMetricsService],
  exports: [PipelineMetricsService],
})
export class PipelineMetricsModule {}

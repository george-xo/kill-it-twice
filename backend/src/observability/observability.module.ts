import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { ElasticsearchModule } from '../destinations/elasticsearch/elasticsearch.module.js';
import { RabbitMqModule } from '../destinations/rabbitmq/rabbitmq.module.js';
import { MetricsController } from './controllers/metrics.controller.js';
import { StatusController } from './controllers/status.controller.js';
import { PipelineMetricsModule } from './pipeline-metrics.module.js';
import { PrometheusMetricsService } from './services/prometheus-metrics.service.js';
import { SystemStatusRepository } from './repositories/system-status.repository.js';
import { SystemStatusService } from './services/system-status.service.js';

@Module({
  imports: [
    DatabaseModule,
    ElasticsearchModule,
    RabbitMqModule,
    PipelineMetricsModule,
  ],
  controllers: [MetricsController, StatusController],
  providers: [
    PrometheusMetricsService,
    SystemStatusRepository,
    SystemStatusService,
  ],
})
export class ObservabilityModule {}

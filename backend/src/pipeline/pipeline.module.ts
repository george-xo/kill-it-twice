import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { ElasticsearchModule } from '../destinations/elasticsearch/elasticsearch.module.js';
import { RabbitMqModule } from '../destinations/rabbitmq/rabbitmq.module.js';
import { PipelineMetricsModule } from '../observability/pipeline-metrics.module.js';
import { ResilienceModule } from '../resilience/resilience.module.js';
import { SimulationModule } from '../simulation/simulation.module.js';
import { ChangeLogRepository } from './change-log/change-log.repository.js';
import { ChangeLogBatchDeliveryService } from './delivery/change-log-batch-delivery.service.js';
import { CustomerChangeDeadLetterService } from './delivery/customer-change-dead-letter.service.js';
import { CustomerChangeDeliveryService } from './delivery/customer-change-delivery.service.js';

@Module({
  imports: [
    DatabaseModule,
    ElasticsearchModule,
    RabbitMqModule,
    ResilienceModule,
    PipelineMetricsModule,
    SimulationModule,
  ],
  providers: [
    ChangeLogRepository,
    CustomerChangeDeliveryService,
    ChangeLogBatchDeliveryService,
    CustomerChangeDeadLetterService,
  ],
  exports: [
    ChangeLogRepository,
    CustomerChangeDeliveryService,
    ChangeLogBatchDeliveryService,
  ],
})
export class PipelineModule {}

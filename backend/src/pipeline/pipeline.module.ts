import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { ElasticsearchModule } from '../destinations/elasticsearch/elasticsearch.module.js';
import { RabbitMqModule } from '../destinations/rabbitmq/rabbitmq.module.js';
import { ChangeLogRepository } from './change-log/change-log.repository.js';
import { ChangeLogBatchDeliveryService } from './delivery/change-log-batch-delivery.service.js';
import { CustomerChangeDeliveryService } from './delivery/customer-change-delivery.service.js';

@Module({
  imports: [DatabaseModule, ElasticsearchModule, RabbitMqModule],
  providers: [
    ChangeLogRepository,
    CustomerChangeDeliveryService,
    ChangeLogBatchDeliveryService,
  ],
  exports: [
    ChangeLogRepository,
    CustomerChangeDeliveryService,
    ChangeLogBatchDeliveryService,
  ],
})
export class PipelineModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from '../database/database.module.js';
import { RabbitMqModule } from '../destinations/rabbitmq/rabbitmq.module.js';
import { CustomerEventConsumerService } from './customer-event-consumer.service.js';
import { CustomerEventIdempotencyRepository } from './customer-event-idempotency.repository.js';
import { PipelineMetricsModule } from '../observability/pipeline-metrics.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
    }),
    DatabaseModule,
    RabbitMqModule,
    PipelineMetricsModule,
  ],
  providers: [CustomerEventIdempotencyRepository, CustomerEventConsumerService],
})
export class CustomerEventConsumerModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RabbitMqModule } from '../destinations/rabbitmq/rabbitmq.module.js';
import { CustomerEventConsumerService } from './customer-event-consumer.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
    }),
    RabbitMqModule,
  ],
  providers: [CustomerEventConsumerService],
})
export class CustomerEventConsumerModule {}

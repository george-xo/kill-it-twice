import { Module } from '@nestjs/common';
import { RabbitMqService } from './rabbitmq.service.js';

@Module({
  providers: [RabbitMqService],
  exports: [RabbitMqService],
})
export class RabbitMqModule {}

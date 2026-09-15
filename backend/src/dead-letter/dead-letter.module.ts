import { Module } from '@nestjs/common';

import { RabbitMqModule } from '../destinations/rabbitmq/rabbitmq.module.js';
import { PipelineModule } from '../pipeline/pipeline.module.js';
import { DeadLetterReplayController } from './dead-letter-replay.controller.js';
import { DeadLetterReplayService } from './dead-letter-replay.service.js';

@Module({
  imports: [
    RabbitMqModule,
    PipelineModule,
  ],
  controllers: [DeadLetterReplayController],
  providers: [DeadLetterReplayService],
})
export class DeadLetterModule {}
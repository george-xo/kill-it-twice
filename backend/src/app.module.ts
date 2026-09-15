import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { CustomersModule } from './customers/customers.module.js';
import { DatabaseModule } from './database/database.module.js';
import { DeadLetterModule } from './dead-letter/dead-letter.module.js';
import { ObservabilityModule } from './observability/observability.module.js';
import { PipelineModule } from './pipeline/pipeline.module.js';
import { SeedModule } from './seed/seed.module.js';
import { SimulationModule } from './simulation/simulation.module.js';
import { WorkerControlModule } from './workers/worker-control.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
    }),
    DatabaseModule,
    SeedModule,
    SimulationModule,
    PipelineModule,
    ObservabilityModule,
    CustomersModule,
    WorkerControlModule,
    DeadLetterModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

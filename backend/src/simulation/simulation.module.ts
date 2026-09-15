import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { SimulationController } from './simulation.controller.js';
import { SimulationRepository } from './simulation.repository.js';
import { SimulationService } from './simulation.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [SimulationController],
  providers: [
    SimulationRepository,
    SimulationService,
  ],
  exports: [SimulationService],
})
export class SimulationModule {}
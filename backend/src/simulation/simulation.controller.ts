import { Controller, Get, Param, Post } from '@nestjs/common';

import type {
  PoisonChangeResult,
  SimulatedCustomerChange,
  SimulationState,
} from './models/simulation-state.model.js';
import { SimulationService } from './simulation.service.js';

@Controller('simulations')
export class SimulationController {
  constructor(private readonly simulationService: SimulationService) {}

  @Get()
  getState(): Promise<SimulationState> {
    return this.simulationService.getState(true);
  }

  @Post('destinations/:destination/fail')
  enableDestinationFailure(
    @Param('destination') destination: string,
  ): Promise<SimulationState> {
    return this.simulationService.enableDestinationFailure(destination);
  }

  @Post('destinations/:destination/recover')
  disableDestinationFailure(
    @Param('destination') destination: string,
  ): Promise<SimulationState> {
    return this.simulationService.disableDestinationFailure(destination);
  }

  @Post('destinations/recover-all')
  resetDestinationFailures(): Promise<SimulationState> {
    return this.simulationService.resetDestinationFailures();
  }

  @Post('customers/:customerId/toggle-status')
  toggleCustomerStatus(
    @Param('customerId') customerId: string,
  ): Promise<SimulatedCustomerChange> {
    return this.simulationService.toggleCustomerStatus(customerId);
  }

  @Post('poison-change')
  createPoisonChange(): Promise<PoisonChangeResult> {
    return this.simulationService.createPoisonChange();
  }
}

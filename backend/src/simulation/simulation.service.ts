import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { DELIVERY_DESTINATIONS } from '../pipeline/contracts/failed-customer-change-event.contract.js';
import type {
  PoisonChangeResult,
  SimulatedCustomerChange,
  SimulatedDestination,
  SimulationState,
} from './models/simulation-state.model.js';
import { SimulationRepository } from './simulation.repository.js';

const SIMULATION_CACHE_DURATION_MS = 500;

@Injectable()
export class SimulationService {
  private cachedState: SimulationState | null = null;
  private cacheExpiresAt = 0;

  constructor(private readonly simulationRepository: SimulationRepository) {}

  async getState(forceRefresh: boolean = false): Promise<SimulationState> {
    const now = Date.now();

    if (
      !forceRefresh &&
      this.cachedState !== null &&
      now < this.cacheExpiresAt
    ) {
      return this.cachedState;
    }

    const row = await this.simulationRepository.findState();

    const state: SimulationState = {
      destinations: {
        elasticsearch: {
          failureEnabled: row.elasticsearch_failure_enabled,
        },
        rabbitmq: {
          failureEnabled: row.rabbitmq_failure_enabled,
        },
      },
      updatedAt: row.updated_at.toISOString(),
    };

    this.cachedState = state;
    this.cacheExpiresAt = now + SIMULATION_CACHE_DURATION_MS;

    return state;
  }

  async enableDestinationFailure(
    destinationValue: string,
  ): Promise<SimulationState> {
    const destination = this.parseDestination(destinationValue);

    await this.simulationRepository.setDestinationFailure(destination, true);

    return this.getState(true);
  }

  async disableDestinationFailure(
    destinationValue: string,
  ): Promise<SimulationState> {
    const destination = this.parseDestination(destinationValue);

    await this.simulationRepository.setDestinationFailure(destination, false);

    return this.getState(true);
  }

  async resetDestinationFailures(): Promise<SimulationState> {
    await this.simulationRepository.resetDestinationFailures();

    return this.getState(true);
  }

  async toggleCustomerStatus(
    customerId: string,
  ): Promise<SimulatedCustomerChange> {
    if (!/^[1-9]\d*$/.test(customerId)) {
      throw new BadRequestException('Customer ID must be a positive integer');
    }

    const customer =
      await this.simulationRepository.toggleCustomerStatus(customerId);

    if (!customer) {
      throw new NotFoundException(`Customer "${customerId}" was not found`);
    }

    return customer;
  }

  createPoisonChange(): Promise<PoisonChangeResult> {
    return this.simulationRepository.createPoisonChange();
  }

  async assertDestinationAvailable(
    destination: SimulatedDestination,
  ): Promise<void> {
    const state = await this.getState();

    if (state.destinations[destination].failureEnabled) {
      throw new Error(
        `Simulated ${destination} destination failure is enabled`,
      );
    }
  }

  private parseDestination(value: string): SimulatedDestination {
    if (
      value !== DELIVERY_DESTINATIONS.ELASTICSEARCH &&
      value !== DELIVERY_DESTINATIONS.RABBITMQ
    ) {
      throw new BadRequestException(
        'Destination must be either "elasticsearch" or "rabbitmq"',
      );
    }

    return value;
  }
}

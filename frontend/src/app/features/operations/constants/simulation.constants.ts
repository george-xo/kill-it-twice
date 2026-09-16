import type { SimulationDestination } from '../models/simulation.model';

export const DEFAULT_SIMULATION_CUSTOMER_ID = '1';

export const SIMULATION_DESTINATIONS = {
  ELASTICSEARCH: 'elasticsearch',
  RABBITMQ: 'rabbitmq',
} as const satisfies Record<string, SimulationDestination>;

export const SIMULATION_MESSAGES = {
  STATE_LOAD_FAILED: 'Simulation state could not be loaded',
  DESTINATION_UPDATED: 'Destination simulation updated',
  CUSTOMER_UPDATED: 'Customer status simulation completed',
  POISON_CHANGE_CREATED: 'Poison change created',
  ACTION_FAILED: 'Simulation action could not be completed',
} as const;

export const SIMULATION_LABELS = {
  FAILURE_ENABLED: 'enabled',
  FAILURE_DISABLED: 'disabled',
  LOADING_STATE: 'Loading simulation state...',
} as const;

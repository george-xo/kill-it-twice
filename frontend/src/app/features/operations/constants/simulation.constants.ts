export const DEFAULT_SIMULATION_CUSTOMER_ID = '1';

export const SIMULATION_MESSAGES = {
  STATE_LOAD_FAILED: 'Simulation state could not be loaded',
  DESTINATION_UPDATED: 'Destination simulation updated',
  CUSTOMER_UPDATED: 'Customer status simulation completed',
  POISON_CHANGE_CREATED: 'Poison change created',
  ACTION_FAILED: 'Simulation action could not be completed',
} as const;

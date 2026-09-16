export type SimulationDestination = 'elasticsearch' | 'rabbitmq';

export interface SimulationState {
  destinations: {
    elasticsearch: {
      failureEnabled: boolean;
    };
    rabbitmq: {
      failureEnabled: boolean;
    };
  };

  updatedAt: string;
}

export interface SimulatedCustomerChange {
  id: string;
  status: 'active' | 'inactive';
  version: number;
  updatedAt: string;
}

export interface PoisonChangeResult {
  changeLogId: string;
  entityId: string;
}

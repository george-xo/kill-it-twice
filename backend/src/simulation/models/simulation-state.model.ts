import type { QueryResultRow } from 'pg';

import type { CustomerStatus } from '../../pipeline/contracts/customer-change-event.contract.js';
import type { DeliveryDestination } from '../../pipeline/contracts/failed-customer-change-event.contract.js';

export type SimulatedDestination = DeliveryDestination;

export interface SimulationStateRow extends QueryResultRow {
  elasticsearch_failure_enabled: boolean;
  rabbitmq_failure_enabled: boolean;
  updated_at: Date;
}

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

export interface SimulatedCustomerChangeRow extends QueryResultRow {
  id: string;
  status: CustomerStatus;
  version: string;
  updated_at: Date;
}

export interface SimulatedCustomerChange {
  id: string;
  status: CustomerStatus;
  version: number;
  updatedAt: string;
}

export interface PoisonChangeRow extends QueryResultRow {
  id: string;
  entity_id: string;
}

export interface PoisonChangeResult {
  changeLogId: string;
  entityId: string;
}

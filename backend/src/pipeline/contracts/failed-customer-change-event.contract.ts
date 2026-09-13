import type { CustomerChangeEvent } from './customer-change-event.contract.js';

export type DeliveryDestination = 'elasticsearch' | 'rabbitmq';

export interface FailedCustomerChangeEvent {
  originalEvent: CustomerChangeEvent;
  failedDestination: DeliveryDestination;
  errorMessage: string;
  failedAt: string;
}

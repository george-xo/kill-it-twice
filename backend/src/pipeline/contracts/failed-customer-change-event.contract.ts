import type { CustomerChangeEvent } from './customer-change-event.contract.js';

export const DELIVERY_DESTINATIONS = {
  ELASTICSEARCH: 'elasticsearch',
  RABBITMQ: 'rabbitmq',
} as const;

export type DeliveryDestination =
  (typeof DELIVERY_DESTINATIONS)[keyof typeof DELIVERY_DESTINATIONS];

export interface FailedCustomerChangeEvent {
  originalEvent: CustomerChangeEvent;
  failedDestination: DeliveryDestination;
  errorMessage: string;
  failedAt: string;
}

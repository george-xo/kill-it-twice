import type { FailedCustomerChangeEvent } from './failed-customer-change-event.contract.js';

export type FailedCustomerChangeHandler = (
  event: FailedCustomerChangeEvent,
) => void | Promise<void>;

export interface DeadLetterReplayResult {
  requestedLimit: number;
  processed: number;
  replayed: number;
  failed: number;
  remaining: number;
}

import type { CustomerChangeEvent } from './customer-change-event.contract.js';

export type CustomerEventHandler = (
  event: CustomerChangeEvent,
) => void | Promise<void>;

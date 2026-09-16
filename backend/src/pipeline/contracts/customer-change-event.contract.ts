export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export const CUSTOMER_STATUSES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const;

export type CustomerStatus =
  (typeof CUSTOMER_STATUSES)[keyof typeof CUSTOMER_STATUSES];

export type CustomerOperation = 'INSERT' | 'UPDATE' | 'DELETE';

export interface CustomerPayload {
  id: string;
  name: string;
  email: string;
  status: CustomerStatus;
  attributes: Record<string, JsonValue>;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerChangeEvent {
  eventId: string;
  entityType: 'customer';
  entityId: string;
  entityVersion: number;
  operation: CustomerOperation;
  payload: CustomerPayload;
  occurredAt: string;
}

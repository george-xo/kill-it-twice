import type { CustomerStatus } from '../models/customer.model';

export const DEFAULT_CUSTOMERS_PAGE_SIZE = 25;

export const CUSTOMER_ID_ROUTE_PARAMETER = 'customerId';

export const CUSTOMER_STATUSES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const satisfies Record<string, CustomerStatus>;

export const CUSTOMER_TABLE_COLUMNS = [
  'id',
  'name',
  'email',
  'status',
  'version',
  'updatedAt',
] as const;

export const CUSTOMERS_MESSAGES = {
  LIST_LOAD_FAILED: 'Customers could not be loaded',
  CUSTOMER_LOAD_FAILED: 'Customer could not be loaded',
  CUSTOMER_ID_MISSING: 'Customer ID is missing',
} as const;

export const CUSTOMERS_LABELS = {
  LOADING: 'Loading...',
  LOAD_MORE: 'Load more',
} as const;

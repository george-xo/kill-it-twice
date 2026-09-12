import type { QueryResultRow } from 'pg';
import type {
  CustomerStatus,
  JsonValue,
} from '../../pipeline/contracts/customer-change-event.contract.js';

export interface BackfillCustomerRow extends QueryResultRow {
  id: string;
  name: string;
  email: string;
  status: CustomerStatus;
  attributes: Record<string, JsonValue>;
  version: string;
  created_at: Date;
  updated_at: Date;
}

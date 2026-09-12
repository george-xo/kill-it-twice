import type { QueryResultRow } from 'pg';
import type {
  CustomerOperation,
  CustomerStatus,
  JsonValue,
} from '../contracts/customer-change-event.contract.js';

export interface ChangeLogPayload {
  id: number;
  name: string;
  email: string;
  status: CustomerStatus;
  attributes: Record<string, JsonValue>;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ChangeLogRow extends QueryResultRow {
  id: string;
  entity_id: string;
  entity_version: string;
  operation: CustomerOperation;
  payload: ChangeLogPayload;
  created_at: Date;
}

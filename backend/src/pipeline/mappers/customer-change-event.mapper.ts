import type { CustomerChangeEvent } from '../contracts/customer-change-event.contract.js';
import type { ChangeLogRow } from '../models/change-log-row.model.js';

export function mapChangeLogRowToCustomerChangeEvent(
  row: ChangeLogRow,
): CustomerChangeEvent {
  const entityVersion = Number(row.entity_version);

  if (!Number.isSafeInteger(entityVersion) || entityVersion < 1) {
    throw new Error(
      `Invalid customer version "${row.entity_version}" for change log "${row.id}"`,
    );
  }

  return {
    eventId: `customer:${row.entity_id}:${row.entity_version}`,
    entityType: 'customer',
    entityId: row.entity_id,
    entityVersion,
    operation: row.operation,
    payload: {
      id: row.entity_id,
      name: row.payload.name,
      email: row.payload.email,
      status: row.payload.status,
      attributes: row.payload.attributes,
      version: entityVersion,
      createdAt: row.payload.created_at,
      updatedAt: row.payload.updated_at,
    },
    occurredAt: row.created_at.toISOString(),
  };
}

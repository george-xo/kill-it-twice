import type { CustomerChangeEvent } from '../../pipeline/contracts/customer-change-event.contract.js';
import type { BackfillCustomerRow } from '../models/backfill-customer-row.model.js';

export function mapBackfillCustomerToEvent(
  customer: BackfillCustomerRow,
): CustomerChangeEvent {
  const version = Number(customer.version);

  if (!Number.isSafeInteger(version) || version < 1) {
    throw new Error(
      `Invalid version "${customer.version}" for customer "${customer.id}"`,
    );
  }

  return {
    eventId: `customer:${customer.id}:${customer.version}`,
    entityType: 'customer',
    entityId: customer.id,
    entityVersion: version,
    operation: 'INSERT',
    payload: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      status: customer.status,
      attributes: customer.attributes,
      version,
      createdAt: customer.created_at.toISOString(),
      updatedAt: customer.updated_at.toISOString(),
    },
    occurredAt: customer.updated_at.toISOString(),
  };
}

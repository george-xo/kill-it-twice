import type { DeliveryDestination } from '../contracts/failed-customer-change-event.contract.js';

export class DestinationDeliveryError extends Error {
  constructor(
    public readonly destination: DeliveryDestination,
    public readonly originalError: unknown,
  ) {
    const originalErrorMessage =
      originalError instanceof Error
        ? originalError.message
        : String(originalError);

    super(`${destination} delivery failed: ${originalErrorMessage}`, {
      cause: originalError,
    });

    this.name = DestinationDeliveryError.name;
  }
}

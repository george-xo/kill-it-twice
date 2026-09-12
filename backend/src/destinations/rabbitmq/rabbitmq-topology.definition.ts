export const CUSTOMER_EVENTS_TOPOLOGY = {
  exchange: {
    name: 'customer.events',
    type: 'topic',
    durable: true,
  },
  queue: {
    name: 'customer.events.consumer',
    durable: true,
  },
  routingKey: 'customer.changed',
} as const;

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

  deadLetterExchange: {
    name: 'customer.events.dlx',
    type: 'topic',
    durable: true,
  },

  deadLetterQueue: {
    name: 'customer.events.dlq',
    durable: true,
  },

  deadLetterRoutingKey: 'customer.failed',
} as const;

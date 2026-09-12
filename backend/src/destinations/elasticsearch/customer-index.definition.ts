export const CUSTOMER_INDEX_DEFINITION = {
  index: 'customers',

  settings: {
    number_of_shards: 1,
    number_of_replicas: 0,
  },

  mappings: {
    dynamic: 'strict',

    properties: {
      id: {
        type: 'keyword',
      },
      name: {
        type: 'text',
        fields: {
          keyword: {
            type: 'keyword',
          },
        },
      },
      email: {
        type: 'keyword',
      },
      status: {
        type: 'keyword',
      },
      attributes: {
        type: 'object',
        dynamic: true,
      },
      version: {
        type: 'long',
      },
      createdAt: {
        type: 'date',
      },
      updatedAt: {
        type: 'date',
      },
    },
  },
} as const;

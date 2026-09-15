import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';

import type {
  CustomerChangeEvent,
  CustomerPayload,
  CustomerStatus,
} from '../../pipeline/contracts/customer-change-event.contract.js';
import { CUSTOMER_INDEX_DEFINITION } from './customer-index.definition.js';

export interface CustomerSearchOptions {
  query?: string;
  status?: CustomerStatus;
  size: number;
  searchAfter?: string[];
}

export interface CustomerSearchHit {
  customer: CustomerPayload;
  sort: string[];
}

export interface CustomerSearchResult {
  items: CustomerSearchHit[];
  total: number;
}

@Injectable()
export class ElasticsearchService implements OnModuleInit, OnModuleDestroy {
  private client: Client | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const host = this.configService.getOrThrow<string>('ELASTICSEARCH_HOST');
    const port = this.configService.getOrThrow<string>('ELASTICSEARCH_PORT');

    this.client = new Client({
      node: `http://${host}:${port}`,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.close();
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.getClient().ping();

      return true;
    } catch {
      return false;
    }
  }

  async ensureCustomerIndex(): Promise<void> {
    const client = this.getClient();

    const indexExists = await client.indices.exists({
      index: CUSTOMER_INDEX_DEFINITION.index,
    });

    if (indexExists) {
      return;
    }

    await client.indices.create(CUSTOMER_INDEX_DEFINITION);
  }

  async indexCustomer(event: CustomerChangeEvent): Promise<void> {
    await this.getClient().index({
      index: CUSTOMER_INDEX_DEFINITION.index,
      id: event.entityId,
      version: event.entityVersion,
      version_type: 'external_gte',
      document: event.payload,
    });
  }

  async deleteCustomer(event: CustomerChangeEvent): Promise<void> {
    await this.getClient().delete(
      {
        index: CUSTOMER_INDEX_DEFINITION.index,
        id: event.entityId,
        version: event.entityVersion,
        version_type: 'external_gte',
      },
      {
        ignore: [404],
      },
    );
  }

  async searchCustomers(
    options: CustomerSearchOptions,
  ): Promise<CustomerSearchResult> {
    const filters = options.status
      ? [
          {
            term: {
              status: options.status,
            },
          },
        ]
      : [];

    const query = options.query
      ? {
          bool: {
            should: [
              {
                match: {
                  name: {
                    query: options.query,
                    operator: 'and' as const,
                  },
                },
              },
              {
                prefix: {
                  email: {
                    value: options.query.toLowerCase(),
                    case_insensitive: true,
                  },
                },
              },
            ],
            minimum_should_match: 1,
            filter: filters,
          },
        }
      : {
          bool: {
            must: [
              {
                match_all: {},
              },
            ],
            filter: filters,
          },
        };

    const result = await this.getClient().search<CustomerPayload>({
      index: CUSTOMER_INDEX_DEFINITION.index,
      size: options.size,
      track_total_hits: true,
      query,
      sort: [
        {
          updatedAt: {
            order: 'desc',
          },
        },
        {
          id: {
            order: 'asc',
          },
        },
      ],
      search_after: options.searchAfter,
    });

    const total =
      typeof result.hits.total === 'number'
        ? result.hits.total
        : (result.hits.total?.value ?? 0);

    const items: CustomerSearchHit[] = [];

    for (const hit of result.hits.hits) {
      if (!hit._source || !hit.sort) {
        continue;
      }

      items.push({
        customer: hit._source,
        sort: hit.sort.map((value) => String(value)),
      });
    }

    return {
      items,
      total,
    };
  }

  async findCustomerById(customerId: string): Promise<CustomerPayload | null> {
    const exists = await this.getClient().exists({
      index: CUSTOMER_INDEX_DEFINITION.index,
      id: customerId,
    });

    if (!exists) {
      return null;
    }

    const result = await this.getClient().get<CustomerPayload>({
      index: CUSTOMER_INDEX_DEFINITION.index,
      id: customerId,
    });

    return result._source ?? null;
  }

  private getClient(): Client {
    if (this.client === null) {
      throw new Error('Elasticsearch client is not initialized');
    }

    return this.client;
  }
}

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';
import type { CustomerChangeEvent } from '../../pipeline/contracts/customer-change-event.contract.js';
import { CUSTOMER_INDEX_DEFINITION } from './customer-index.definition.js';

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

  private getClient(): Client {
    if (this.client === null) {
      throw new Error('Elasticsearch client is not initialized');
    }

    return this.client;
  }
}

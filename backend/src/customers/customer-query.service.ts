import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { ElasticsearchService } from '../destinations/elasticsearch/elasticsearch.service.js';
import type {
  CustomerPayload,
  CustomerStatus,
} from '../pipeline/contracts/customer-change-event.contract.js';

const DEFAULT_PAGE_SIZE = 25;
const MAXIMUM_PAGE_SIZE = 100;

export interface CustomerQueryParameters {
  query?: string;
  status?: string;
  limit?: string;
  cursor?: string;
}

export interface CustomerListResponse {
  items: CustomerPayload[];
  total: number;
  nextCursor: string | null;
}

@Injectable()
export class CustomerQueryService {
  constructor(private readonly elasticsearchService: ElasticsearchService) {}

  async findAll(
    parameters: CustomerQueryParameters,
  ): Promise<CustomerListResponse> {
    const limit = this.parseLimit(parameters.limit);
    const status = this.parseStatus(parameters.status);
    const searchAfter = this.decodeCursor(parameters.cursor);
    const query = this.normalizeQuery(parameters.query);

    const result = await this.elasticsearchService.searchCustomers({
      query,
      status,
      size: limit + 1,
      searchAfter,
    });

    const hasNextPage = result.items.length > limit;
    const pageItems = result.items.slice(0, limit);
    const lastItem = pageItems.at(-1);

    return {
      items: pageItems.map((item) => item.customer),
      total: result.total,
      nextCursor:
        hasNextPage && lastItem ? this.encodeCursor(lastItem.sort) : null,
    };
  }

  async findById(customerId: string): Promise<CustomerPayload> {
    if (!/^[1-9]\d*$/.test(customerId)) {
      throw new BadRequestException('Customer ID must be a positive integer');
    }

    const customer =
      await this.elasticsearchService.findCustomerById(customerId);

    if (!customer) {
      throw new NotFoundException(`Customer "${customerId}" was not found`);
    }

    return customer;
  }

  private parseLimit(value: string | undefined): number {
    if (value === undefined) {
      return DEFAULT_PAGE_SIZE;
    }

    const limit = Number(value);

    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > MAXIMUM_PAGE_SIZE
    ) {
      throw new BadRequestException(
        `Limit must be an integer between 1 and ${MAXIMUM_PAGE_SIZE}`,
      );
    }

    return limit;
  }

  private parseStatus(value: string | undefined): CustomerStatus | undefined {
    if (value === undefined || value === '') {
      return undefined;
    }

    if (value !== 'active' && value !== 'inactive') {
      throw new BadRequestException(
        'Status must be either "active" or "inactive"',
      );
    }

    return value;
  }

  private normalizeQuery(value: string | undefined): string | undefined {
    const query = value?.trim();

    return query ? query : undefined;
  }

  private encodeCursor(sort: string[]): string {
    return Buffer.from(JSON.stringify(sort)).toString('base64url');
  }

  private decodeCursor(cursor: string | undefined): string[] | undefined {
    if (!cursor) {
      return undefined;
    }

    try {
      const decoded: unknown = JSON.parse(
        Buffer.from(cursor, 'base64url').toString('utf8'),
      );

      if (
        !Array.isArray(decoded) ||
        decoded.length !== 2 ||
        !decoded.every((value) => typeof value === 'string')
      ) {
        throw new Error('Invalid cursor structure');
      }

      return decoded;
    } catch {
      throw new BadRequestException('Cursor is invalid');
    }
  }
}

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, QueryResult, QueryResultRow, PoolClient } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool?: Pool;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.pool = new Pool({
      host: this.configService.getOrThrow<string>('POSTGRES_HOST'),
      port: Number(this.configService.getOrThrow<string>('POSTGRES_PORT')),
      database: this.configService.getOrThrow<string>('POSTGRES_DB'),
      user: this.configService.getOrThrow<string>('POSTGRES_USER'),
      password: this.configService.getOrThrow<string>('POSTGRES_PASSWORD'),
    });

    await this.pool.query('SELECT 1');
  }

  async query<T extends QueryResultRow>(
    sql: string,
    parameters: unknown[] = [],
  ): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new Error('Database connection is not initialized');
    }

    return this.pool.query<T>(sql, parameters);
  }

  async withTransaction<T>(
    operation: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    if (!this.pool) {
      throw new Error('Database connection is not initialized');
    }

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const result = await operation(client);

      await client.query('COMMIT');

      return result;
    } catch (error) {
      await client.query('ROLLBACK');

      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }
}

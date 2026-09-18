import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Pool,
  type PoolClient,
  type QueryResult,
  type QueryResultRow,
} from 'pg';

interface AdvisoryLockRow extends QueryResultRow {
  acquired: boolean;
}

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
    } catch (error: unknown) {
      await client.query('ROLLBACK');

      throw error;
    } finally {
      client.release();
    }
  }

  async tryWithAdvisoryLock(
    lockName: string,
    operation: () => Promise<void>,
  ): Promise<boolean> {
    if (!this.pool) {
      throw new Error('Database connection is not initialized');
    }

    const client = await this.pool.connect();
    let lockAcquired = false;

    try {
      const result = await client.query<AdvisoryLockRow>(
        `
          SELECT pg_try_advisory_lock(
            hashtextextended($1, 0)
          ) AS acquired
        `,
        [lockName],
      );

      lockAcquired = result.rows[0]?.acquired === true;

      if (!lockAcquired) {
        return false;
      }

      await operation();

      return true;
    } finally {
      try {
        if (lockAcquired) {
          await client.query(
            `
              SELECT pg_advisory_unlock(
                hashtextextended($1, 0)
              )
            `,
            [lockName],
          );
        }
      } finally {
        client.release();
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }
}

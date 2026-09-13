import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from './database.service.js';
import { migration001 } from './migrations/001-create-source-tables.js';
import { migration002 } from './migrations/002-create-backfill-state.js';
import { migration003 } from './migrations/003-create-incremental-sync-state.js';

const migrations = [migration001, migration002, migration003];
@Injectable()
export class MigrationRunnerService {
  private readonly logger = new Logger(MigrationRunnerService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async run(): Promise<void> {
    await this.createMigrationsTable();

    for (const migration of migrations) {
      await this.runMigration(migration);
    }
  }

  private async createMigrationsTable(): Promise<void> {
    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }

  private async runMigration(migration: {
    name: string;
    sql: string;
  }): Promise<void> {
    await this.databaseService.withTransaction(async (client) => {
      const appliedMigration = await client.query(
        `
          SELECT name
          FROM schema_migrations
          WHERE name = $1;
        `,
        [migration.name],
      );

      if (appliedMigration.rows.length > 0) {
        this.logger.log(`Migration already applied: ${migration.name}`);
        return;
      }

      await client.query(migration.sql);

      await client.query(
        `
          INSERT INTO schema_migrations (name)
          VALUES ($1);
        `,
        [migration.name],
      );

      this.logger.log(`Migration applied: ${migration.name}`);
    });
  }
}

import { NestFactory } from '@nestjs/core';
import { DatabaseMigrationModule } from './database/database-migration.module.js';
import { MigrationRunnerService } from './database/migration-runner.service.js';

async function migrate(): Promise<void> {
  const application = await NestFactory.createApplicationContext(
    DatabaseMigrationModule,
  );

  try {
    const migrationRunner = application.get(MigrationRunnerService);

    await migrationRunner.run();
  } finally {
    await application.close();
  }
}

void migrate();

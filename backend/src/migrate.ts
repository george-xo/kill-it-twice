import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { MigrationRunnerService } from './database/migration-runner.service.js';

async function migrate(): Promise<void> {
  const application = await NestFactory.createApplicationContext(AppModule);

  try {
    const migrationRunner = application.get(MigrationRunnerService);
    await migrationRunner.run();
  } finally {
    await application.close();
  }
}

void migrate();

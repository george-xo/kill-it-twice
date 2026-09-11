import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service.js';
import { MigrationRunnerService } from './migration-runner.service.js';

@Module({
  providers: [DatabaseService, MigrationRunnerService],
  exports: [DatabaseService, MigrationRunnerService],
})
export class DatabaseModule {}

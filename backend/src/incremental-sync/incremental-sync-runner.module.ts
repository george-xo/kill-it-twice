import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { IncrementalSyncModule } from './incremental-sync.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
    }),
    IncrementalSyncModule,
  ],
})
export class IncrementalSyncRunnerModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BackfillModule } from './backfill.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
    }),
    BackfillModule,
  ],
})
export class BackfillRunnerModule {}

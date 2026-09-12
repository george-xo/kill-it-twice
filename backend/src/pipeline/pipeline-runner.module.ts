import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PipelineModule } from './pipeline.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
    }),
    PipelineModule,
  ],
})
export class PipelineRunnerModule {}

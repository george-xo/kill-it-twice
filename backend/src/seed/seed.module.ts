import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { SeedService } from './seed.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}

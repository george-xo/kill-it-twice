import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { SeedService } from './seed/seed.service.js';

const logger = new Logger('Seed');

async function runSeed(): Promise<void> {
  const application = await NestFactory.createApplicationContext(AppModule);

  try {
    const seedService = application.get(SeedService);
    const count = Number(process.env.SEED_COUNT ?? 1_000);

    await seedService.seed(count);

    logger.log(`Seed completed: ${count} customers`);
  } finally {
    await application.close();
  }
}

void runSeed();

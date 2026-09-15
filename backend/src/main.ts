import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const application = await NestFactory.create(AppModule);

  application.enableCors({
    origin: ['http://localhost:4200', 'http://localhost:8080'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await application.listen(process.env.PORT ?? 3000);
}

await bootstrap();

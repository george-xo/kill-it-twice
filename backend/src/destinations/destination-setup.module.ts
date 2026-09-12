import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ElasticsearchModule } from './elasticsearch/elasticsearch.module.js';
import { RabbitMqModule } from './rabbitmq/rabbitmq.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
    }),
    ElasticsearchModule,
    RabbitMqModule,
  ],
})
export class DestinationSetupModule {}

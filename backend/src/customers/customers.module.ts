import { Module } from '@nestjs/common';

import { ElasticsearchModule } from '../destinations/elasticsearch/elasticsearch.module.js';
import { CustomerQueryService } from './customer-query.service.js';
import { CustomersController } from './customers.controller.js';

@Module({
  imports: [ElasticsearchModule],
  controllers: [CustomersController],
  providers: [CustomerQueryService],
})
export class CustomersModule {}

import { Module } from '@nestjs/common';

import { DestinationRetryService } from './destination-retry.service.js';

@Module({
  providers: [DestinationRetryService],
  exports: [DestinationRetryService],
})
export class ResilienceModule {}

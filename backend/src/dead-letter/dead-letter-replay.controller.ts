import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';

import type { DeadLetterReplayResult } from '../pipeline/contracts/dead-letter-replay.contract.js';
import { DeadLetterReplayService } from './dead-letter-replay.service.js';

@Controller('dead-letter-queue')
export class DeadLetterReplayController {
  constructor(
    private readonly deadLetterReplayService: DeadLetterReplayService,
  ) {}

  @Post('replay')
  @HttpCode(HttpStatus.OK)
  replay(
    @Query('limit') limit: string | undefined,
  ): Promise<DeadLetterReplayResult> {
    return this.deadLetterReplayService.replay(limit);
  }
}
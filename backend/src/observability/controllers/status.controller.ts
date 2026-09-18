import { Controller, Get } from '@nestjs/common';

import type { SystemStatus } from '../models/system-status.model.js';
import { SystemStatusService } from '../services/system-status.service.js';

@Controller('status')
export class StatusController {
  constructor(private readonly systemStatusService: SystemStatusService) {}

  @Get()
  getStatus(): Promise<SystemStatus> {
    return this.systemStatusService.getStatus();
  }
}

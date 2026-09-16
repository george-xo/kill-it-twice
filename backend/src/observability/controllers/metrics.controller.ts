import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';

import { PrometheusMetricsService } from '../services/prometheus-metrics.service.js';

@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly prometheusMetricsService: PrometheusMetricsService,
  ) {}

  @Get()
  async getMetrics(@Res() response: Response): Promise<void> {
    const metrics = await this.prometheusMetricsService.render();

    response.setHeader(
      'Content-Type',
      this.prometheusMetricsService.contentType,
    );

    response.send(metrics);
  }
}

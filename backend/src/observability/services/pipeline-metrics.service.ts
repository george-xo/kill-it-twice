import { Injectable, Logger } from '@nestjs/common';

import type { PipelineMetric } from '../models/pipeline-metric.model.js';
import type { PipelineMetricName } from '../constants/pipeline-metrics.constants.js';
import { PipelineMetricsRepository } from '../repositories/pipeline-metrics.repository.js';

@Injectable()
export class PipelineMetricsService {
  private readonly logger = new Logger(PipelineMetricsService.name);

  constructor(
    private readonly pipelineMetricsRepository: PipelineMetricsRepository,
  ) {}

  async increment(
    metricName: PipelineMetricName,
    amount: number = 1,
  ): Promise<void> {
    try {
      await this.pipelineMetricsRepository.increment(metricName, amount);
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to update metric ${metricName}: ${this.getErrorMessage(error)}`,
      );
    }
  }

  async findAll(): Promise<PipelineMetric[]> {
    return this.pipelineMetricsRepository.findAll();
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}

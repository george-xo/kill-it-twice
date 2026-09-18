import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../database/database.service.js';
import type {
  PipelineMetric,
  PipelineMetricRow,
} from '../models/pipeline-metric.model.js';
import type { PipelineMetricName } from '../constants/pipeline-metrics.constants.js';

@Injectable()
export class PipelineMetricsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async increment(
    metricName: PipelineMetricName,
    amount: number = 1,
  ): Promise<void> {
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new Error('Metric increment amount must be a positive integer');
    }

    await this.databaseService.query(
      `
        INSERT INTO pipeline_metrics (
          metric_name,
          value
        )
        VALUES ($1, $2)
        ON CONFLICT (metric_name)
        DO UPDATE SET
          value = pipeline_metrics.value + EXCLUDED.value,
          updated_at = NOW();
      `,
      [metricName, amount],
    );
  }

  async findAll(): Promise<PipelineMetric[]> {
    const result = await this.databaseService.query<PipelineMetricRow>(`
      SELECT
        metric_name,
        value,
        updated_at
      FROM pipeline_metrics
      ORDER BY metric_name;
    `);

    return result.rows.map((row) => ({
      name: row.metric_name,
      value: Number(row.value),
      updatedAt: row.updated_at,
    }));
  }
}

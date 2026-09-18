import type { QueryResultRow } from 'pg';

import type { PipelineMetricName } from '../constants/pipeline-metrics.constants.js';

export interface PipelineMetricRow extends QueryResultRow {
  metric_name: PipelineMetricName;
  value: string;
  updated_at: Date;
}

export interface PipelineMetric {
  name: PipelineMetricName;
  value: number;
  updatedAt: Date;
}

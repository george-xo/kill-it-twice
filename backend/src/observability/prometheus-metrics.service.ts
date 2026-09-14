import { Injectable } from '@nestjs/common';
import { Counter, Registry } from 'prom-client';

import type { PipelineMetricName } from './pipeline-metrics.constants.js';
import { PIPELINE_METRIC_DEFINITIONS } from './pipeline-metric-definitions.js';
import { PipelineMetricsService } from './pipeline-metrics.service.js';

@Injectable()
export class PrometheusMetricsService {
  private readonly registry = new Registry();

  private readonly counters = new Map<PipelineMetricName, Counter>();

  constructor(private readonly pipelineMetricsService: PipelineMetricsService) {
    for (const definition of PIPELINE_METRIC_DEFINITIONS) {
      const counter = new Counter({
        name: definition.name,
        help: definition.help,
        registers: [this.registry],
      });

      this.counters.set(definition.name, counter);
    }
  }

  get contentType(): string {
    return this.registry.contentType;
  }

  async render(): Promise<string> {
    const storedMetrics = await this.pipelineMetricsService.findAll();

    for (const counter of this.counters.values()) {
      counter.reset();
    }

    for (const metric of storedMetrics) {
      if (metric.value > 0) {
        this.counters.get(metric.name)?.inc(metric.value);
      }
    }

    return this.registry.metrics();
  }
}

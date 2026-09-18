import { Injectable } from '@nestjs/common';

import { ElasticsearchService } from '../../destinations/elasticsearch/elasticsearch.service.js';
import { RabbitMqService } from '../../destinations/rabbitmq/rabbitmq.service.js';
import { WORKER_STATES } from '../../workers/models/worker-command-response.model.js';
import { PIPELINE_METRICS } from '../constants/pipeline-metrics.constants.js';
import type { PipelineMetric } from '../models/pipeline-metric.model.js';
import type {
  PipelineCounters,
  PipelineStatus,
  SystemStatus,
} from '../models/system-status.model.js';
import { SystemStatusRepository } from '../repositories/system-status.repository.js';
import { PipelineMetricsService } from './pipeline-metrics.service.js';

@Injectable()
export class SystemStatusService {
  constructor(
    private readonly systemStatusRepository: SystemStatusRepository,
    private readonly elasticsearchService: ElasticsearchService,
    private readonly rabbitMqService: RabbitMqService,
    private readonly pipelineMetricsService: PipelineMetricsService,
  ) {}

  async getStatus(): Promise<SystemStatus> {
    const [databaseResult, elasticsearchAvailable, rabbitMqResult] =
      await Promise.all([
        this.getDatabaseStatus(),
        this.elasticsearchService.isAvailable(),
        this.getRabbitMqStatus(),
      ]);

    const dependencies: SystemStatus['dependencies'] = {
      database: {
        status: databaseResult.available ? 'up' : 'down',
      },
      elasticsearch: {
        status: elasticsearchAvailable ? 'up' : 'down',
      },
      rabbitmq: {
        status: rabbitMqResult.available ? 'up' : 'down',
      },
    };

    const allDependenciesAvailable = Object.values(dependencies).every(
      (dependency) => dependency.status === 'up',
    );

    const allWorkersOperational = Object.values(databaseResult.workers).every(
      (worker) => worker !== null && worker.status !== WORKER_STATES.FAILED,
    );

    return {
      status:
        allDependenciesAvailable && allWorkersOperational
          ? 'healthy'
          : 'degraded',
      checkedAt: new Date().toISOString(),
      dependencies,
      workers: databaseResult.workers,
      pipeline: {
        ...databaseResult.pipeline,
        mainQueueMessageCount: rabbitMqResult.mainQueueMessageCount,
        deadLetterQueueMessageCount: rabbitMqResult.deadLetterQueueMessageCount,
      },
    };
  }

  private async getDatabaseStatus(): Promise<{
    available: boolean;
    workers: SystemStatus['workers'];
    pipeline: Omit<
      PipelineStatus,
      'mainQueueMessageCount' | 'deadLetterQueueMessageCount'
    >;
  }> {
    try {
      await this.systemStatusRepository.pingDatabase();

      const [workers, snapshot, metrics] = await Promise.all([
        this.systemStatusRepository.findWorkerStatuses(),
        this.systemStatusRepository.findPipelineSnapshot(),
        this.pipelineMetricsService.findAll(),
      ]);

      const latestChangeId = Number(snapshot.latest_change_id);

      const processedChangeId = Number(snapshot.processed_change_id);

      const processedLastMinute = Number(snapshot.processed_last_minute);

      return {
        available: true,
        workers,
        pipeline: {
          sourceRecordCount: Number(snapshot.source_record_count),
          latestChangeId,
          processedChangeId,
          incrementalLag: Math.max(latestChangeId - processedChangeId, 0),
          throughputPerSecond: Number((processedLastMinute / 60).toFixed(2)),
          counters: this.createCounters(metrics),
        },
      };
    } catch {
      return {
        available: false,
        workers: {
          backfill: null,
          incrementalSync: null,
        },
        pipeline: {
          sourceRecordCount: null,
          latestChangeId: null,
          processedChangeId: null,
          incrementalLag: null,
          throughputPerSecond: null,
          counters: null,
        },
      };
    }
  }

  private async getRabbitMqStatus(): Promise<{
    available: boolean;
    mainQueueMessageCount: number | null;
    deadLetterQueueMessageCount: number | null;
  }> {
    try {
      const queueCounts =
        await this.rabbitMqService.getCustomerQueueMessageCounts();

      return {
        available: true,
        mainQueueMessageCount: queueCounts.mainQueue,
        deadLetterQueueMessageCount: queueCounts.deadLetterQueue,
      };
    } catch {
      return {
        available: false,
        mainQueueMessageCount: null,
        deadLetterQueueMessageCount: null,
      };
    }
  }

  private createCounters(metrics: PipelineMetric[]): PipelineCounters {
    const values = new Map(
      metrics.map((metric) => [metric.name, metric.value]),
    );

    return {
      deliveredEvents: values.get(PIPELINE_METRICS.DELIVERED_EVENTS) ?? 0,
      elasticsearchRetries:
        values.get(PIPELINE_METRICS.ELASTICSEARCH_RETRIES) ?? 0,
      rabbitMqRetries: values.get(PIPELINE_METRICS.RABBITMQ_RETRIES) ?? 0,
      processedEvents:
        values.get(PIPELINE_METRICS.CONSUMER_PROCESSED_EVENTS) ?? 0,
      duplicateEvents:
        values.get(PIPELINE_METRICS.CONSUMER_DUPLICATE_EVENTS) ?? 0,
      deadLetterEvents: values.get(PIPELINE_METRICS.DEAD_LETTER_EVENTS) ?? 0,
    };
  }
}

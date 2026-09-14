import { Injectable } from '@nestjs/common';

import { ElasticsearchService } from '../destinations/elasticsearch/elasticsearch.service.js';
import { RabbitMqService } from '../destinations/rabbitmq/rabbitmq.service.js';
import type { SystemStatus } from './models/system-status.model.js';
import { SystemStatusRepository } from './system-status.repository.js';

@Injectable()
export class SystemStatusService {
  constructor(
    private readonly systemStatusRepository: SystemStatusRepository,
    private readonly elasticsearchService: ElasticsearchService,
    private readonly rabbitMqService: RabbitMqService,
  ) {}

  async getStatus(): Promise<SystemStatus> {
    const [databaseResult, elasticsearchAvailable, rabbitMqAvailable] =
      await Promise.all([
        this.getDatabaseStatus(),
        this.elasticsearchService.isAvailable(),
        this.rabbitMqService.isAvailable(),
      ]);

    const dependencies: SystemStatus['dependencies'] = {
      database: {
        status: databaseResult.available ? 'up' : 'down',
      },
      elasticsearch: {
        status: elasticsearchAvailable ? 'up' : 'down',
      },
      rabbitmq: {
        status: rabbitMqAvailable ? 'up' : 'down',
      },
    };

    const allDependenciesAvailable = Object.values(dependencies).every(
      (dependency) => dependency.status === 'up',
    );

    const allWorkersOperational = Object.values(databaseResult.workers).every(
      (worker) => worker === null || worker.status !== 'failed',
    );

    return {
      status:
        allDependenciesAvailable && allWorkersOperational
          ? 'healthy'
          : 'degraded',
      checkedAt: new Date().toISOString(),
      dependencies,
      workers: databaseResult.workers,
    };
  }

  private async getDatabaseStatus(): Promise<{
    available: boolean;
    workers: SystemStatus['workers'];
  }> {
    try {
      await this.systemStatusRepository.pingDatabase();

      const workers = await this.systemStatusRepository.findWorkerStatuses();

      return {
        available: true,
        workers,
      };
    } catch {
      return {
        available: false,
        workers: {
          backfill: null,
          incrementalSync: null,
        },
      };
    }
  }
}

import { PIPELINE_METRICS } from '../constants/pipeline-metrics.constants.js';

export const PIPELINE_METRIC_DEFINITIONS = [
  {
    name: PIPELINE_METRICS.DELIVERED_EVENTS,
    help: 'Total number of customer events delivered to all destinations',
  },
  {
    name: PIPELINE_METRICS.ELASTICSEARCH_RETRIES,
    help: 'Total number of Elasticsearch delivery retries',
  },
  {
    name: PIPELINE_METRICS.RABBITMQ_RETRIES,
    help: 'Total number of RabbitMQ delivery retries',
  },
  {
    name: PIPELINE_METRICS.CONSUMER_PROCESSED_EVENTS,
    help: 'Total number of uniquely processed consumer events',
  },
  {
    name: PIPELINE_METRICS.CONSUMER_DUPLICATE_EVENTS,
    help: 'Total number of duplicate consumer events',
  },
  {
    name: PIPELINE_METRICS.DEAD_LETTER_EVENTS,
    help: 'Total number of events published to the dead-letter queue',
  },
] as const;

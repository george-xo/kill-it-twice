export const PIPELINE_METRICS = {
  DELIVERED_EVENTS: 'pipeline_delivered_events_total',
  ELASTICSEARCH_RETRIES: 'pipeline_elasticsearch_retries_total',
  RABBITMQ_RETRIES: 'pipeline_rabbitmq_retries_total',
  CONSUMER_PROCESSED_EVENTS: 'consumer_processed_events_total',
  CONSUMER_DUPLICATE_EVENTS: 'consumer_duplicate_events_total',
  DEAD_LETTER_EVENTS: 'pipeline_dead_letter_events_total',
} as const;

export type PipelineMetricName =
  (typeof PIPELINE_METRICS)[keyof typeof PIPELINE_METRICS];

export const migration004 = {
  name: '004-create-consumer-idempotency',

  sql: `
    CREATE TABLE consumer_processed_events (
      consumer_name VARCHAR(100) NOT NULL,
      event_id VARCHAR(255) NOT NULL,

      entity_type VARCHAR(50) NOT NULL,
      entity_id BIGINT NOT NULL,
      entity_version BIGINT NOT NULL,
      operation VARCHAR(10) NOT NULL,
      payload JSONB NOT NULL,

      processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      PRIMARY KEY (
        consumer_name,
        event_id
      ),

      CONSTRAINT consumer_processed_events_entity_version_check
        CHECK (entity_version > 0),

      CONSTRAINT consumer_processed_events_operation_check
        CHECK (
          operation IN (
            'INSERT',
            'UPDATE',
            'DELETE'
          )
        )
    );

    CREATE INDEX consumer_processed_events_entity_idx
      ON consumer_processed_events (
        entity_type,
        entity_id,
        entity_version
      );
  `,
};

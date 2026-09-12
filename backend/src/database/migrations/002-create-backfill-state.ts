export const migration002 = {
  name: '002-create-backfill-state',

  sql: `
    CREATE TABLE backfill_jobs (
      name VARCHAR(100) PRIMARY KEY,

      status VARCHAR(20) NOT NULL DEFAULT 'pending',

      snapshot_max_id BIGINT NOT NULL DEFAULT 0,
      last_processed_id BIGINT NOT NULL DEFAULT 0,
      processed_count BIGINT NOT NULL DEFAULT 0,

      started_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ,

      last_error TEXT,

      CONSTRAINT backfill_jobs_status_check
        CHECK (
          status IN (
            'pending',
            'running',
            'completed',
            'failed'
          )
        ),

      CONSTRAINT backfill_jobs_snapshot_max_id_check
        CHECK (snapshot_max_id >= 0),

      CONSTRAINT backfill_jobs_last_processed_id_check
        CHECK (last_processed_id >= 0),

      CONSTRAINT backfill_jobs_processed_count_check
        CHECK (processed_count >= 0),

      CONSTRAINT backfill_jobs_checkpoint_range_check
        CHECK (last_processed_id <= snapshot_max_id)
    );
  `,
};

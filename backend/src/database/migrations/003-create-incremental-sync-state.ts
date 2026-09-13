export const migration003 = {
  name: '003-create-incremental-sync-state',

  sql: `
    ALTER TABLE backfill_jobs
    ADD COLUMN incremental_start_change_id BIGINT NOT NULL DEFAULT 0;

    ALTER TABLE backfill_jobs
    ADD CONSTRAINT backfill_jobs_incremental_start_change_id_check
    CHECK (incremental_start_change_id >= 0);

    CREATE TABLE incremental_sync_jobs (
      name VARCHAR(100) PRIMARY KEY,

      status VARCHAR(20) NOT NULL DEFAULT 'pending',

      start_change_id BIGINT NOT NULL,
      last_processed_change_id BIGINT NOT NULL,
      processed_count BIGINT NOT NULL DEFAULT 0,

      started_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      last_error TEXT,

      CONSTRAINT incremental_sync_jobs_status_check
        CHECK (
          status IN (
            'pending',
            'running',
            'stopped',
            'failed'
          )
        ),

      CONSTRAINT incremental_sync_jobs_start_change_id_check
        CHECK (start_change_id >= 0),

      CONSTRAINT incremental_sync_jobs_last_processed_change_id_check
        CHECK (last_processed_change_id >= start_change_id),

      CONSTRAINT incremental_sync_jobs_processed_count_check
        CHECK (processed_count >= 0)
    );
  `,
};

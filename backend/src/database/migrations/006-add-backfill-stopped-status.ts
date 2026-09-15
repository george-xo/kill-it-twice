export const migration006 = {
  name: '006-add-backfill-stopped-status',

  sql: `
    ALTER TABLE backfill_jobs
    DROP CONSTRAINT backfill_jobs_status_check;

    ALTER TABLE backfill_jobs
    ADD CONSTRAINT backfill_jobs_status_check
    CHECK (
      status IN (
        'pending',
        'running',
        'stopped',
        'completed',
        'failed'
      )
    );
  `,
};

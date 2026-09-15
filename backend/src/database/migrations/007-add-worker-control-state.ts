export const migration007 = {
  name: '007-add-worker-control-state',

  sql: `
    ALTER TABLE backfill_jobs
    ADD COLUMN stop_requested BOOLEAN NOT NULL DEFAULT FALSE;

    ALTER TABLE incremental_sync_jobs
    ADD COLUMN stop_requested BOOLEAN NOT NULL DEFAULT FALSE;
  `,
};

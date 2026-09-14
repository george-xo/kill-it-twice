export const migration005 = {
  name: '005-create-pipeline-metrics',

  sql: `
    CREATE TABLE pipeline_metrics (
      metric_name VARCHAR(100) PRIMARY KEY,
      value BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT pipeline_metrics_value_check
        CHECK (value >= 0)
    );
  `,
};

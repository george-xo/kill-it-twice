export const migration008 = {
  name: '008-create-simulation-state',

  sql: `
    CREATE TABLE pipeline_simulation_state (
      name VARCHAR(100) PRIMARY KEY,

      elasticsearch_failure_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      rabbitmq_failure_enabled BOOLEAN NOT NULL DEFAULT FALSE,

      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    INSERT INTO pipeline_simulation_state (name)
    VALUES ('global');
  `,
};
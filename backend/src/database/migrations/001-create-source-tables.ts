export const migration001 = {
  name: '001-create-source-tables',

  sql: `
    CREATE TABLE customers (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      email VARCHAR(320) NOT NULL UNIQUE,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
      version BIGINT NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT customers_status_check
        CHECK (status IN ('active', 'inactive')),

      CONSTRAINT customers_version_check
        CHECK (version > 0)
    );

    CREATE TABLE change_log (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      entity_id BIGINT NOT NULL,
      entity_version BIGINT NOT NULL,
      operation VARCHAR(10) NOT NULL,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT change_log_operation_check
        CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),

      CONSTRAINT change_log_entity_version_unique
        UNIQUE (entity_id, entity_version)
    );

    CREATE INDEX change_log_created_at_idx
      ON change_log (created_at);

    CREATE OR REPLACE FUNCTION update_customer_version()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.version := OLD.version + 1;
      NEW.updated_at := NOW();

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER customers_before_update
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_customer_version();

    CREATE OR REPLACE FUNCTION save_customer_change()
    RETURNS TRIGGER AS $$
    BEGIN
      IF TG_OP = 'DELETE' THEN
        INSERT INTO change_log (
          entity_id,
          entity_version,
          operation,
          payload
        )
        VALUES (
          OLD.id,
          OLD.version + 1,
          TG_OP,
          to_jsonb(OLD) || jsonb_build_object(
            'version',
            OLD.version + 1
          )
        );

        RETURN OLD;
      END IF;

      INSERT INTO change_log (
        entity_id,
        entity_version,
        operation,
        payload
      )
      VALUES (
        NEW.id,
        NEW.version,
        TG_OP,
        to_jsonb(NEW)
      );

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER customers_after_change
    AFTER INSERT OR UPDATE OR DELETE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION save_customer_change();
  `,
};

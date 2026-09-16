import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service.js';
import type {
  PoisonChangeResult,
  PoisonChangeRow,
  SimulatedCustomerChange,
  SimulatedCustomerChangeRow,
  SimulatedDestination,
  SimulationStateRow,
} from './models/simulation-state.model.js';

@Injectable()
export class SimulationRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findState(): Promise<SimulationStateRow> {
    await this.databaseService.query(`
      INSERT INTO pipeline_simulation_state (name)
      VALUES ('global')
      ON CONFLICT (name) DO NOTHING;
    `);

    const result = await this.databaseService.query<SimulationStateRow>(`
        SELECT
          elasticsearch_failure_enabled,
          rabbitmq_failure_enabled,
          updated_at
        FROM pipeline_simulation_state
        WHERE name = 'global';
      `);

    const state = result.rows[0];

    if (!state) {
      throw new Error('Pipeline simulation state was not found');
    }

    return state;
  }

  async setDestinationFailure(
    destination: SimulatedDestination,
    enabled: boolean,
  ): Promise<void> {
    if (destination === 'elasticsearch') {
      await this.databaseService.query(
        `
          UPDATE pipeline_simulation_state
          SET
            elasticsearch_failure_enabled = $1,
            updated_at = NOW()
          WHERE name = 'global';
        `,
        [enabled],
      );

      return;
    }

    await this.databaseService.query(
      `
        UPDATE pipeline_simulation_state
        SET
          rabbitmq_failure_enabled = $1,
          updated_at = NOW()
        WHERE name = 'global';
      `,
      [enabled],
    );
  }

  async resetDestinationFailures(): Promise<void> {
    await this.databaseService.query(`
      UPDATE pipeline_simulation_state
      SET
        elasticsearch_failure_enabled = FALSE,
        rabbitmq_failure_enabled = FALSE,
        updated_at = NOW()
      WHERE name = 'global';
    `);
  }

  async toggleCustomerStatus(
    customerId: string,
  ): Promise<SimulatedCustomerChange | null> {
    const result = await this.databaseService.query<SimulatedCustomerChangeRow>(
      `
          UPDATE customers
          SET
            status = CASE
              WHEN status = 'active' THEN 'inactive'
              ELSE 'active'
            END
          WHERE id = $1::BIGINT
          RETURNING
            id::TEXT,
            status,
            version::TEXT,
            updated_at;
        `,
      [customerId],
    );

    const customer = result.rows[0];

    if (!customer) {
      return null;
    }

    return {
      id: customer.id,
      status: customer.status,
      version: Number(customer.version),
      updatedAt: customer.updated_at.toISOString(),
    };
  }

  async createPoisonChange(): Promise<PoisonChangeResult> {
    const result = await this.databaseService.query<PoisonChangeRow>(`
      WITH generated_entity AS (
        SELECT GREATEST(
          COALESCE(MAX(entity_id), 0) + 1,
          900000
        ) AS entity_id
        FROM change_log
      )
      INSERT INTO change_log (
        entity_id,
        entity_version,
        operation,
        payload
      )
      SELECT
        entity_id,
        1,
        'INSERT',
        jsonb_build_object(
          'id', entity_id::TEXT,
          'name', 'Poison Customer ' || entity_id,
          'email', 'poison-' || entity_id || '@example.com',
          'status', jsonb_build_object(
            'invalid',
            TRUE
          ),
          'attributes', jsonb_build_object(
            'source',
            'simulation'
          ),
          'version', 1,
          'created_at', NOW(),
          'updated_at', NOW()
        )
      FROM generated_entity
      RETURNING
        id::TEXT,
        entity_id::TEXT;
    `);

    const change = result.rows[0];

    if (!change) {
      throw new Error('Poison change was not created');
    }

    return {
      changeLogId: change.id,
      entityId: change.entity_id,
    };
  }
}

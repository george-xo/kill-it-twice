import { setTimeout as delay } from 'node:timers/promises';

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  DEFAULT_DESTINATION_RETRY_INITIAL_DELAY_MS,
  DEFAULT_DESTINATION_RETRY_MAX_ATTEMPTS,
  DEFAULT_DESTINATION_RETRY_MAX_DELAY_MS,
  DESTINATION_RETRY_INITIAL_DELAY_MS_CONFIG_KEY,
  DESTINATION_RETRY_MAX_ATTEMPTS_CONFIG_KEY,
  DESTINATION_RETRY_MAX_DELAY_MS_CONFIG_KEY,
} from './destination-retry.constants.js';

@Injectable()
export class DestinationRetryService implements OnModuleInit {
  private readonly logger = new Logger(DestinationRetryService.name);

  private maxAttempts = DEFAULT_DESTINATION_RETRY_MAX_ATTEMPTS;
  private initialDelayMs = DEFAULT_DESTINATION_RETRY_INITIAL_DELAY_MS;
  private maxDelayMs = DEFAULT_DESTINATION_RETRY_MAX_DELAY_MS;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    this.maxAttempts = Number(
      this.configService.get<string>(
        DESTINATION_RETRY_MAX_ATTEMPTS_CONFIG_KEY,
        String(DEFAULT_DESTINATION_RETRY_MAX_ATTEMPTS),
      ),
    );

    this.initialDelayMs = Number(
      this.configService.get<string>(
        DESTINATION_RETRY_INITIAL_DELAY_MS_CONFIG_KEY,
        String(DEFAULT_DESTINATION_RETRY_INITIAL_DELAY_MS),
      ),
    );

    this.maxDelayMs = Number(
      this.configService.get<string>(
        DESTINATION_RETRY_MAX_DELAY_MS_CONFIG_KEY,
        String(DEFAULT_DESTINATION_RETRY_MAX_DELAY_MS),
      ),
    );

    this.validateConfiguration();
  }

  async execute<T>(
    operationName: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    let delayMs = this.initialDelayMs;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        const result = await operation();

        if (attempt > 1) {
          this.logger.log(`${operationName} recovered on attempt ${attempt}`);
        }

        return result;
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        if (attempt === this.maxAttempts) {
          this.logger.error(
            `${operationName} failed after ${attempt} attempts: ${errorMessage}`,
          );

          throw error;
        }

        this.logger.warn(
          `${operationName} failed on attempt ${attempt}: ${errorMessage}. Retrying in ${delayMs}ms`,
        );

        await delay(delayMs);

        delayMs = Math.min(delayMs * 2, this.maxDelayMs);
      }
    }

    throw new Error(`${operationName} retry loop ended unexpectedly`);
  }

  private validateConfiguration(): void {
    if (!Number.isInteger(this.maxAttempts) || this.maxAttempts < 1) {
      throw new Error(
        `${DESTINATION_RETRY_MAX_ATTEMPTS_CONFIG_KEY} must be a positive integer`,
      );
    }

    if (!Number.isInteger(this.initialDelayMs) || this.initialDelayMs < 1) {
      throw new Error(
        `${DESTINATION_RETRY_INITIAL_DELAY_MS_CONFIG_KEY} must be a positive integer`,
      );
    }

    if (!Number.isInteger(this.maxDelayMs) || this.maxDelayMs < 1) {
      throw new Error(
        `${DESTINATION_RETRY_MAX_DELAY_MS_CONFIG_KEY} must be a positive integer`,
      );
    }

    if (this.initialDelayMs > this.maxDelayMs) {
      throw new Error(
        `${DESTINATION_RETRY_INITIAL_DELAY_MS_CONFIG_KEY} cannot be greater than ${DESTINATION_RETRY_MAX_DELAY_MS_CONFIG_KEY}`,
      );
    }
  }
}

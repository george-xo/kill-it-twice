import { Logger } from '@nestjs/common';

import type {
  StructuredLogEntry,
  StructuredLogFields,
} from './models/structured-log.model.js';

export class StructuredLogger {
  private readonly logger: Logger;

  constructor(private readonly component: string) {
    this.logger = new Logger(component);
  }

  log(event: string, fields: StructuredLogFields = {}): void {
    this.logger.log(this.serialize(event, fields));
  }

  warn(event: string, fields: StructuredLogFields = {}): void {
    this.logger.warn(this.serialize(event, fields));
  }

  error(event: string, fields: StructuredLogFields = {}): void {
    this.logger.error(this.serialize(event, fields));
  }

  private serialize(event: string, fields: StructuredLogFields): string {
    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      component: this.component,
      event,
      fields,
    };

    return JSON.stringify(entry);
  }
}

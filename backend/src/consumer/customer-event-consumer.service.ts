import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { CustomerChangeEvent } from '../pipeline/contracts/customer-change-event.contract.js';
import { RabbitMqService } from '../destinations/rabbitmq/rabbitmq.service.js';

@Injectable()
export class CustomerEventConsumerService implements OnModuleInit {
  private readonly logger = new Logger(CustomerEventConsumerService.name);

  constructor(private readonly rabbitMqService: RabbitMqService) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitMqService.consumeCustomerChanges((event) => {
      this.handleCustomerChange(event);
    });

    this.logger.log('Waiting for customer change events');
  }

  private handleCustomerChange(event: CustomerChangeEvent): void {
    this.logger.log(
      `Received event ${event.eventId}: ${event.operation} customer ${event.entityId}, version ${event.entityVersion}`,
    );
  }
}

import { once } from 'node:events';

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import type { Channel, ChannelModel, ConfirmChannel } from 'amqplib';

import type { CustomerChangeEvent } from '../../pipeline/contracts/customer-change-event.contract.js';
import type {
  DeadLetterReplayResult,
  FailedCustomerChangeHandler,
} from '../../pipeline/contracts/dead-letter-replay.contract.js';
import type { CustomerEventHandler } from '../../pipeline/contracts/customer-event-handler.contract.js';
import type { FailedCustomerChangeEvent } from '../../pipeline/contracts/failed-customer-change-event.contract.js';
import { CUSTOMER_EVENTS_TOPOLOGY } from './rabbitmq-topology.definition.js';

const CONSUMER_RECONNECT_DELAY_MS = 1_000;

@Injectable()
export class RabbitMqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqService.name);

  private connectionUrl = '';

  private connection: ChannelModel | null = null;
  private publisherChannel: ConfirmChannel | null = null;
  private consumerChannel: Channel | null = null;

  private consumerHandler: CustomerEventHandler | null = null;
  private consumerReconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private topologyReady = false;
  private isShuttingDown = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const host = this.configService.getOrThrow<string>('RABBITMQ_HOST');
    const port = this.configService.getOrThrow<string>('RABBITMQ_PORT');
    const username = this.configService.getOrThrow<string>('RABBITMQ_USER');
    const password = this.configService.getOrThrow<string>('RABBITMQ_PASSWORD');

    this.connectionUrl =
      `amqp://${encodeURIComponent(username)}:` +
      `${encodeURIComponent(password)}@${host}:${port}`;
  }

  async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;
    this.consumerHandler = null;

    if (this.consumerReconnectTimer !== null) {
      clearTimeout(this.consumerReconnectTimer);
      this.consumerReconnectTimer = null;
    }

    await this.consumerChannel?.close();
    await this.publisherChannel?.close();
    await this.connection?.close();

    this.consumerChannel = null;
    this.publisherChannel = null;
    this.connection = null;
    this.topologyReady = false;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const connection = await this.getConnection();
      const channel = await connection.createChannel();

      await channel.close();

      return true;
    } catch {
      return false;
    }
  }

  async ensureTopology(): Promise<void> {
    if (this.topologyReady) {
      return;
    }

    const connection = await this.getConnection();
    const channel = await connection.createChannel();

    try {
      await channel.assertExchange(
        CUSTOMER_EVENTS_TOPOLOGY.exchange.name,
        CUSTOMER_EVENTS_TOPOLOGY.exchange.type,
        {
          durable: CUSTOMER_EVENTS_TOPOLOGY.exchange.durable,
        },
      );

      await channel.assertExchange(
        CUSTOMER_EVENTS_TOPOLOGY.deadLetterExchange.name,
        CUSTOMER_EVENTS_TOPOLOGY.deadLetterExchange.type,
        {
          durable: CUSTOMER_EVENTS_TOPOLOGY.deadLetterExchange.durable,
        },
      );

      await channel.assertQueue(CUSTOMER_EVENTS_TOPOLOGY.queue.name, {
        durable: CUSTOMER_EVENTS_TOPOLOGY.queue.durable,
      });

      await channel.assertQueue(CUSTOMER_EVENTS_TOPOLOGY.deadLetterQueue.name, {
        durable: CUSTOMER_EVENTS_TOPOLOGY.deadLetterQueue.durable,
      });

      await channel.bindQueue(
        CUSTOMER_EVENTS_TOPOLOGY.queue.name,
        CUSTOMER_EVENTS_TOPOLOGY.exchange.name,
        CUSTOMER_EVENTS_TOPOLOGY.routingKey,
      );

      await channel.bindQueue(
        CUSTOMER_EVENTS_TOPOLOGY.deadLetterQueue.name,
        CUSTOMER_EVENTS_TOPOLOGY.deadLetterExchange.name,
        CUSTOMER_EVENTS_TOPOLOGY.deadLetterRoutingKey,
      );

      this.topologyReady = true;
    } finally {
      await channel.close();
    }
  }

  async getCustomerQueueMessageCounts(): Promise<{
    mainQueue: number;
    deadLetterQueue: number;
  }> {
    await this.ensureTopology();

    const connection = await this.getConnection();
    const channel = await connection.createChannel();

    try {
      const mainQueue = await channel.checkQueue(
        CUSTOMER_EVENTS_TOPOLOGY.queue.name,
      );

      const deadLetterQueue = await channel.checkQueue(
        CUSTOMER_EVENTS_TOPOLOGY.deadLetterQueue.name,
      );

      return {
        mainQueue: mainQueue.messageCount,
        deadLetterQueue: deadLetterQueue.messageCount,
      };
    } finally {
      await channel.close();
    }
  }

  async replayFailedCustomerChanges(
    limit: number,
    handler: FailedCustomerChangeHandler,
  ): Promise<DeadLetterReplayResult> {
    await this.ensureTopology();

    const connection = await this.getConnection();
    const channel = await connection.createChannel();

    let processed = 0;
    let replayed = 0;
    let failed = 0;

    try {
      while (processed < limit) {
        const message = await channel.get(
          CUSTOMER_EVENTS_TOPOLOGY.deadLetterQueue.name,
          {
            noAck: false,
          },
        );

        if (message === false) {
          break;
        }

        processed += 1;

        try {
          const failedEvent = JSON.parse(
            message.content.toString('utf8'),
          ) as FailedCustomerChangeEvent;

          await handler(failedEvent);

          channel.ack(message);
          replayed += 1;
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          channel.nack(message, false, true);
          failed += 1;

          this.logger.warn(
            `DLQ replay stopped after failed message: ${errorMessage}`,
          );

          break;
        }
      }

      const queue = await channel.checkQueue(
        CUSTOMER_EVENTS_TOPOLOGY.deadLetterQueue.name,
      );

      return {
        requestedLimit: limit,
        processed,
        replayed,
        failed,
        remaining: queue.messageCount,
      };
    } finally {
      await channel.close();
    }
  }

  async publishCustomerChange(event: CustomerChangeEvent): Promise<void> {
    await this.ensureTopology();

    const channel = await this.getPublisherChannel();
    const message = Buffer.from(JSON.stringify(event));

    const accepted = channel.publish(
      CUSTOMER_EVENTS_TOPOLOGY.exchange.name,
      CUSTOMER_EVENTS_TOPOLOGY.routingKey,
      message,
      {
        persistent: true,
        contentType: 'application/json',
        messageId: event.eventId,
        type: event.operation,
        timestamp: Date.now(),
      },
    );

    if (!accepted) {
      await once(channel, 'drain');
    }

    await channel.waitForConfirms();
  }

  async publishFailedCustomerChange(
    failedEvent: FailedCustomerChangeEvent,
  ): Promise<void> {
    await this.ensureTopology();

    const channel = await this.getPublisherChannel();
    const message = Buffer.from(JSON.stringify(failedEvent));

    const accepted = channel.publish(
      CUSTOMER_EVENTS_TOPOLOGY.deadLetterExchange.name,
      CUSTOMER_EVENTS_TOPOLOGY.deadLetterRoutingKey,
      message,
      {
        persistent: true,
        contentType: 'application/json',
        messageId: failedEvent.originalEvent.eventId,
        type: 'customer.delivery.failed',
        timestamp: Date.now(),
        headers: {
          failedDestination: failedEvent.failedDestination,
        },
      },
    );

    if (!accepted) {
      await once(channel, 'drain');
    }

    await channel.waitForConfirms();
  }

  async consumeCustomerChanges(handler: CustomerEventHandler): Promise<void> {
    this.consumerHandler = handler;

    await this.startConsumer(handler);
  }

  private async startConsumer(handler: CustomerEventHandler): Promise<void> {
    await this.ensureTopology();

    const channel = await this.getConsumerChannel();

    await channel.consume(
      CUSTOMER_EVENTS_TOPOLOGY.queue.name,
      async (message) => {
        if (message === null) {
          return;
        }

        try {
          const event = JSON.parse(
            message.content.toString('utf8'),
          ) as CustomerChangeEvent;

          await handler(event);

          channel.ack(message);
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          this.logger.error(
            `Customer event processing failed: ${errorMessage}`,
          );

          channel.nack(message, false, true);
        }
      },
      {
        noAck: false,
      },
    );
  }

  private scheduleConsumerReconnect(): void {
    if (
      this.isShuttingDown ||
      this.consumerHandler === null ||
      this.consumerReconnectTimer !== null
    ) {
      return;
    }

    this.logger.warn(
      `RabbitMQ consumer reconnect scheduled in ${CONSUMER_RECONNECT_DELAY_MS}ms`,
    );

    this.consumerReconnectTimer = setTimeout(() => {
      this.consumerReconnectTimer = null;
      void this.reconnectConsumer();
    }, CONSUMER_RECONNECT_DELAY_MS);
  }

  private async reconnectConsumer(): Promise<void> {
    const handler = this.consumerHandler;

    if (this.isShuttingDown || handler === null) {
      return;
    }

    try {
      await this.startConsumer(handler);
      this.logger.log('RabbitMQ consumer connection recovered');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.logger.warn(`RabbitMQ consumer reconnect failed: ${errorMessage}`);

      this.scheduleConsumerReconnect();
    }
  }

  private async getConnection(): Promise<ChannelModel> {
    if (this.connection !== null) {
      return this.connection;
    }

    const connection = await amqp.connect(this.connectionUrl);

    connection.on('error', (error: Error) => {
      this.logger.error('RabbitMQ connection error', error.stack);
    });

    connection.on('close', () => {
      if (this.connection === connection) {
        this.connection = null;
        this.publisherChannel = null;
        this.consumerChannel = null;
        this.topologyReady = false;
      }

      if (!this.isShuttingDown) {
        this.logger.warn('RabbitMQ connection closed unexpectedly');

        this.scheduleConsumerReconnect();
      }
    });

    this.connection = connection;

    return connection;
  }

  private async getPublisherChannel(): Promise<ConfirmChannel> {
    if (this.publisherChannel !== null) {
      return this.publisherChannel;
    }

    const connection = await this.getConnection();
    const channel = await connection.createConfirmChannel();

    channel.on('close', () => {
      if (this.publisherChannel === channel) {
        this.publisherChannel = null;
      }
    });

    this.publisherChannel = channel;

    return channel;
  }

  private async getConsumerChannel(): Promise<Channel> {
    if (this.consumerChannel !== null) {
      return this.consumerChannel;
    }

    const connection = await this.getConnection();
    const channel = await connection.createChannel();

    channel.on('close', () => {
      if (this.consumerChannel === channel) {
        this.consumerChannel = null;
      }

      this.scheduleConsumerReconnect();
    });

    await channel.prefetch(10);

    this.consumerChannel = channel;

    return channel;
  }
}

import { Injectable, Inject } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { Channel } from 'amqplib';
import { EXCHANGES } from '@sentinelx/shared';

export interface QueueMessage<T = unknown> {
  type: string;
  payload: T;
  organizationId?: string;
  userId?: string;
  correlationId?: string;
  timestamp: string;
  retryCount?: number;
}

export interface PublishOptions {
  persistent?: boolean;
  priority?: number;
  expiration?: number;
  headers?: Record<string, unknown>;
}

@Injectable()
export class QueueService {
  constructor(
    @Inject('RABBITMQ_CHANNEL') private readonly channel: Channel,
    @InjectPinoLogger(QueueService.name)
    private readonly logger: PinoLogger,
  ) {}

  async publish<T>(
    routingKey: string,
    message: QueueMessage<T>,
    options: PublishOptions = {},
  ): Promise<boolean> {
    const content = Buffer.from(JSON.stringify(message));

    const result = this.channel.publish(
      EXCHANGES.SENTINELX_EVENTS,
      routingKey,
      content,
      {
        persistent: options.persistent !== false,
        priority: options.priority,
        expiration: options.expiration !== undefined ? String(options.expiration) : undefined,
        headers: options.headers,
        contentType: 'application/json',
        timestamp: Date.now(),
        correlationId: message.correlationId,
        messageId: `${routingKey}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      },
    );

    if (!result) {
      this.logger.warn({ routingKey }, 'Message queue is full, message may be lost');
    }

    return result;
  }

  async sendToQueue<T>(
    queue: string,
    message: QueueMessage<T>,
    options: PublishOptions = {},
  ): Promise<boolean> {
    const content = Buffer.from(JSON.stringify(message));

    const result = this.channel.sendToQueue(queue, content, {
      persistent: options.persistent !== false,
      priority: options.priority,
      contentType: 'application/json',
      timestamp: Date.now(),
    });

    return result;
  }

  async consume<T>(
    queue: string,
    handler: (message: QueueMessage<T>) => Promise<void>,
    options: { noAck?: boolean; exclusive?: boolean } = {},
  ): Promise<void> {
    await this.channel.consume(
      queue,
      async (msg) => {
        if (!msg) return;

        try {
          const message = JSON.parse(msg.content.toString()) as QueueMessage<T>;
          await handler(message);

          if (!options.noAck) {
            this.channel.ack(msg);
          }
        } catch (err) {
          this.logger.error({ err, queue }, 'Failed to process queue message');

          if (!options.noAck) {
            const retryCount = (msg.properties.headers?.['x-retry-count'] as number | undefined) ?? 0;
            if (retryCount < 3) {
              this.channel.nack(msg, false, false); // Send to DLX
            } else {
              this.channel.nack(msg, false, false); // Give up
            }
          }
        }
      },
      { noAck: options.noAck ?? false, exclusive: options.exclusive ?? false },
    );
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.channel.checkQueue('sentinelx.scan.jobs');
      return true;
    } catch {
      return false;
    }
  }
}

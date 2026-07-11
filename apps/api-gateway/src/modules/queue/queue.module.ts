import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service';
import { EXCHANGES, QUEUES } from '@sentinelx/shared';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'RABBITMQ_CHANNEL',
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const amqplib = await import('amqplib');
        const url = config.get<string>('RABBITMQ_URL', 'amqp://guest:guest@localhost:5672');

        let connection: Awaited<ReturnType<typeof amqplib.connect>>;
        let retries = 0;
        const maxRetries = 10;

        while (retries < maxRetries) {
          try {
            connection = await amqplib.connect(url);
            break;
          } catch (err) {
            retries++;
            if (retries === maxRetries) throw err;
            await new Promise((r) => setTimeout(r, 3000));
          }
        }

        const channel = await connection!.createChannel();

        // Set up exchanges
        await channel.assertExchange(EXCHANGES.SENTINELX_EVENTS, 'topic', { durable: true });
        await channel.assertExchange(EXCHANGES.SENTINELX_DEAD_LETTER, 'direct', { durable: true });

        // Set up queues with DLX
        for (const queue of Object.values(QUEUES)) {
          await channel.assertQueue(queue, {
            durable: true,
            arguments: {
              'x-dead-letter-exchange': EXCHANGES.SENTINELX_DEAD_LETTER,
              'x-dead-letter-routing-key': `${queue}.dead`,
              'x-message-ttl': 86400000, // 24 hours
            },
          });
        }

        // Set prefetch for fair dispatch
        await channel.prefetch(10);

        return channel;
      },
    },
    QueueService,
  ],
  exports: [QueueService, 'RABBITMQ_CHANNEL'],
})
export class QueueModule {}

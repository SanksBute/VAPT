import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { NotificationEvent } from '@sentinelx/shared';
import { createHmac } from 'crypto';

@Injectable()
export class WebhookDeliveryService {
  constructor(
    @InjectPinoLogger(WebhookDeliveryService.name)
    private readonly logger: PinoLogger,
    private readonly prisma: PrismaService,
  ) {}

  async deliver(orgId: string, event: NotificationEvent): Promise<void> {
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        organizationId: orgId,
        isActive: true,
        deletedAt: null,
        events: { has: event.type },
      },
    });

    await Promise.allSettled(
      webhooks.map((webhook) => this.deliverToWebhook(webhook, event)),
    );
  }

  private async deliverToWebhook(
    webhook: { id: string; url: string; secret: string | null; headers: unknown; timeout: number },
    event: NotificationEvent,
  ): Promise<void> {
    const payload = JSON.stringify({
      id: `evt_${Date.now()}`,
      type: event.type,
      created: new Date().toISOString(),
      data: event,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-SentinelX-Event': event.type,
      'X-SentinelX-Timestamp': String(Math.floor(Date.now() / 1000)),
      ...((webhook.headers as Record<string, string>) ?? {}),
    };

    if (webhook.secret) {
      const signature = createHmac('sha256', webhook.secret)
        .update(payload)
        .digest('hex');
      headers['X-SentinelX-Signature'] = `sha256=${signature}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), webhook.timeout * 1000);

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: payload,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      await this.prisma.webhookDelivery.create({
        data: {
          webhookId: webhook.id,
          eventType: event.type,
          payload: JSON.parse(payload) as Prisma.InputJsonValue,
          statusCode: response.status,
          success: response.ok,
          attempt: 1,
        },
      });

      if (response.ok) {
        await this.prisma.webhook.update({
          where: { id: webhook.id },
          data: {
            lastTriggeredAt: new Date(),
            lastStatusCode: response.status,
            successCount: { increment: 1 },
          },
        });
      }
    } catch (err) {
      clearTimeout(timeoutId);

      await this.prisma.webhook.update({
        where: { id: webhook.id },
        data: { failureCount: { increment: 1 } },
      });

      this.logger.error({ err, webhookId: webhook.id }, 'Webhook delivery failed');
    }
  }
}

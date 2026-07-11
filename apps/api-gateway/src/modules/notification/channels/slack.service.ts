import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NotificationEvent } from '@sentinelx/shared';

@Injectable()
export class SlackService {
  constructor(private readonly configService: ConfigService) {}

  async sendNotification(
    event: NotificationEvent,
    config: Record<string, unknown>,
  ): Promise<void> {
    const webhookUrl = (config['webhookUrl'] as string | undefined) ?? this.configService.get<string>('SLACK_WEBHOOK_URL');
    if (!webhookUrl) return;

    const color = {
      CRITICAL: '#dc2626',
      HIGH: '#ea580c',
      MEDIUM: '#d97706',
      LOW: '#2563eb',
      INFO: '#6b7280',
    }[event.severity] ?? '#6b7280';

    const payload = {
      attachments: [
        {
          color,
          title: event.title,
          text: event.message,
          footer: 'SentinelX AI',
          ts: Math.floor(Date.now() / 1000),
          actions: event.actionUrl ? [
            {
              type: 'button',
              text: 'View Details',
              url: `${process.env['FRONTEND_URL']}${event.actionUrl}`,
            },
          ] : [],
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.statusText}`);
    }
  }
}

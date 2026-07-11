import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { NotificationStatus, NotificationSeverity } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { QueueService } from '../queue/queue.service';
import { EmailService } from './channels/email.service';
import { SlackService } from './channels/slack.service';
import { WebhookDeliveryService } from './channels/webhook-delivery.service';
import { QUEUES } from '@sentinelx/shared';
import type { NotificationEvent } from '@sentinelx/shared';

@Injectable()
export class NotificationService {
  constructor(
    @InjectPinoLogger(NotificationService.name)
    private readonly logger: PinoLogger,
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly emailService: EmailService,
    private readonly slackService: SlackService,
    private readonly webhookService: WebhookDeliveryService,
  ) {}

  async sendNotification(event: NotificationEvent): Promise<void> {
    // Queue for async processing
    await this.queue.sendToQueue(QUEUES.NOTIFICATION_DELIVERY, {
      type: event.type,
      payload: event,
      organizationId: event.organizationId,
      timestamp: new Date().toISOString(),
    });
  }

  async processNotification(event: NotificationEvent): Promise<void> {
    // Create in-app notification
    await this.prisma.notification.create({
      data: {
        organizationId: event.organizationId,
        userId: event.userId,
        channel: 'IN_APP',
        severity: event.severity as NotificationSeverity,
        status: NotificationStatus.SENT,
        title: event.title,
        message: event.message,
        eventType: event.type,
        entityType: event.entityType,
        entityId: event.entityId,
        actionUrl: event.actionUrl,
        data: (event.data ?? {}) as Prisma.InputJsonValue,
        sentAt: new Date(),
      },
    });

    // Get user/org notification preferences
    const preferences = await this.prisma.notificationPreference.findMany({
      where: {
        organizationId: event.organizationId,
        eventType: event.type,
        isEnabled: true,
        ...(event.userId ? { userId: event.userId } : {}),
      },
    });

    // Dispatch to each enabled channel
    for (const pref of preferences) {
      switch (pref.channel) {
        case 'EMAIL':
          await this.emailService.sendNotificationEmail(event, pref.config as Record<string, unknown>).catch(
            (err: unknown) => this.logger.error({ err }, 'Failed to send email notification'),
          );
          break;
        case 'SLACK':
          await this.slackService.sendNotification(event, pref.config as Record<string, unknown>).catch(
            (err: unknown) => this.logger.error({ err }, 'Failed to send Slack notification'),
          );
          break;
        case 'WEBHOOK':
          await this.webhookService.deliver(event.organizationId, event).catch(
            (err: unknown) => this.logger.error({ err }, 'Failed to deliver webhook'),
          );
          break;
      }
    }
  }

  async sendEmailVerification(email: string, token: string, firstName: string): Promise<void> {
    const verifyUrl = `${process.env['FRONTEND_URL']}/verify-email?token=${token}`;
    await this.emailService.send({
      to: email,
      subject: 'Verify your SentinelX AI account',
      template: 'email-verification',
      data: { firstName, verifyUrl, expiresIn: '24 hours' },
    });
  }

  async sendPasswordReset(email: string, token: string, firstName: string): Promise<void> {
    const resetUrl = `${process.env['FRONTEND_URL']}/reset-password?token=${token}`;
    await this.emailService.send({
      to: email,
      subject: 'Reset your SentinelX AI password',
      template: 'password-reset',
      data: { firstName, resetUrl, expiresIn: '2 hours' },
    });
  }

  async sendInvitation(
    email: string,
    inviterName: string,
    orgName: string,
    token: string,
  ): Promise<void> {
    const inviteUrl = `${process.env['FRONTEND_URL']}/accept-invitation?token=${token}`;
    await this.emailService.send({
      to: email,
      subject: `You've been invited to join ${orgName} on SentinelX AI`,
      template: 'invitation',
      data: { inviterName, orgName, inviteUrl, expiresIn: '7 days' },
    });
  }

  async list(
    userId: string,
    orgId: string,
    options: { unreadOnly?: boolean; limit?: number } = {},
  ): Promise<{ items: unknown[]; unreadCount: number }> {
    const where: Prisma.NotificationWhereInput = {
      userId,
      organizationId: orgId,
      channel: 'IN_APP',
      ...(options.unreadOnly ? { readAt: null } : {}),
    };

    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(options.limit ?? 50, 100),
        select: {
          id: true,
          severity: true,
          title: true,
          message: true,
          eventType: true,
          entityType: true,
          entityId: true,
          actionUrl: true,
          readAt: true,
          createdAt: true,
        },
      }),
      this.prisma.notification.count({
        where: { userId, organizationId: orgId, channel: 'IN_APP', readAt: null },
      }),
    ]);

    return { items, unreadCount };
  }

  async getUnreadCount(userId: string, orgId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        userId,
        organizationId: orgId,
        channel: 'IN_APP',
        readAt: null,
      },
    });
  }

  async markAsRead(notificationIds: string[], userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id: { in: notificationIds }, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string, orgId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, organizationId: orgId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}

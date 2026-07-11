import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { NotificationEvent } from '@sentinelx/shared';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  template: string;
  data: Record<string, unknown>;
  attachments?: Array<{ filename: string; content: string | Buffer; contentType: string }>;
}

@Injectable()
export class EmailService {
  private transporter: Transporter | null = null;

  constructor(
    @InjectPinoLogger(EmailService.name)
    private readonly logger: PinoLogger,
    private readonly configService: ConfigService,
  ) {
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT', 587);
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (!host) {
      this.logger.warn('SMTP not configured — email notifications disabled');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });
  }

  async send(options: EmailOptions): Promise<void> {
    if (!this.transporter) {
      this.logger.warn({ to: options.to, subject: options.subject }, 'Email not sent — SMTP not configured');
      return;
    }

    const html = this.renderTemplate(options.template, options.data);
    const from = `${this.configService.get('SMTP_FROM_NAME', 'SentinelX AI')} <${this.configService.get('SMTP_FROM', 'noreply@sentinelx.io')}>`;

    try {
      await this.transporter.sendMail({
        from,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html,
        attachments: options.attachments,
      });
    } catch (err) {
      this.logger.error({ err, to: options.to, subject: options.subject }, 'Failed to send email');
      throw err;
    }
  }

  async sendNotificationEmail(
    event: NotificationEvent,
    _config: Record<string, unknown>,
  ): Promise<void> {
    if (!event.userId) return;

    const user = await this.getUserEmail(event.userId);
    if (!user) return;

    await this.send({
      to: user.email,
      subject: event.title,
      template: 'notification',
      data: {
        firstName: user.firstName,
        title: event.title,
        message: event.message,
        severity: event.severity,
        actionUrl: event.actionUrl ? `${process.env['FRONTEND_URL']}${event.actionUrl}` : undefined,
      },
    });
  }

  private renderTemplate(template: string, data: Record<string, unknown>): string {
    const templates: Record<string, (d: Record<string, unknown>) => string> = {
      'email-verification': (d) => `
        <!DOCTYPE html><html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #0f172a; padding: 30px; border-radius: 8px; color: white; text-align: center;">
          <h1 style="color: #6366f1; margin: 0;">SentinelX AI</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc; border-radius: 0 0 8px 8px;">
          <h2>Welcome, ${d['firstName'] as string}!</h2>
          <p>Please verify your email address to activate your SentinelX AI account.</p>
          <a href="${d['verifyUrl'] as string}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 20px 0;">
            Verify Email Address
          </a>
          <p style="color: #64748b; font-size: 14px;">This link expires in ${d['expiresIn'] as string}.</p>
        </div>
        </body></html>
      `,
      'password-reset': (d) => `
        <!DOCTYPE html><html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #0f172a; padding: 30px; border-radius: 8px; color: white; text-align: center;">
          <h1 style="color: #6366f1; margin: 0;">SentinelX AI</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc; border-radius: 0 0 8px 8px;">
          <h2>Password Reset Request</h2>
          <p>Hi ${d['firstName'] as string},</p>
          <p>We received a request to reset your password. Click the button below to set a new password:</p>
          <a href="${d['resetUrl'] as string}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 20px 0;">
            Reset Password
          </a>
          <p style="color: #ef4444; font-size: 14px;"><strong>If you didn't request this, please ignore this email.</strong></p>
          <p style="color: #64748b; font-size: 14px;">This link expires in ${d['expiresIn'] as string}.</p>
        </div>
        </body></html>
      `,
      'invitation': (d) => `
        <!DOCTYPE html><html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #0f172a; padding: 30px; border-radius: 8px; color: white; text-align: center;">
          <h1 style="color: #6366f1; margin: 0;">SentinelX AI</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc; border-radius: 0 0 8px 8px;">
          <h2>You've been invited to ${d['orgName'] as string}</h2>
          <p>${d['inviterName'] as string} has invited you to join <strong>${d['orgName'] as string}</strong> on SentinelX AI.</p>
          <a href="${d['inviteUrl'] as string}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 20px 0;">
            Accept Invitation
          </a>
          <p style="color: #64748b; font-size: 14px;">This invitation expires in ${d['expiresIn'] as string}.</p>
        </div>
        </body></html>
      `,
      'notification': (d) => `
        <!DOCTYPE html><html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #0f172a; padding: 30px; border-radius: 8px; color: white; text-align: center;">
          <h1 style="color: #6366f1; margin: 0;">SentinelX AI</h1>
        </div>
        <div style="padding: 30px; background: #f8fafc; border-radius: 0 0 8px 8px;">
          <h2>${d['title'] as string}</h2>
          <p>Hi ${d['firstName'] as string},</p>
          <p>${d['message'] as string}</p>
          ${d['actionUrl'] ? `<a href="${d['actionUrl'] as string}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 20px 0;">View Details</a>` : ''}
        </div>
        </body></html>
      `,
    };

    const render = templates[template];
    if (!render) return `<p>${JSON.stringify(data)}</p>`;
    return render(data);
  }

  private async getUserEmail(
    userId: string,
  ): Promise<{ email: string; firstName: string } | null> {
    // This would be injected via DI, simplified here
    return null;
  }
}

import { Module, Global } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { EmailService } from './channels/email.service';
import { SlackService } from './channels/slack.service';
import { WebhookDeliveryService } from './channels/webhook-delivery.service';
import { DatabaseModule } from '../database/database.module';
import { QueueModule } from '../queue/queue.module';
import { ConfigModule } from '@nestjs/config';

@Global()
@Module({
  imports: [DatabaseModule, QueueModule, ConfigModule],
  providers: [NotificationService, EmailService, SlackService, WebhookDeliveryService],
  controllers: [NotificationController],
  exports: [NotificationService],
})
export class NotificationModule {}

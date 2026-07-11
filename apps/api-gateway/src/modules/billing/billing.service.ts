import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import Stripe from 'stripe';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class BillingService {
  private readonly stripe: Stripe | null = null;

  constructor(
    @InjectPinoLogger(BillingService.name)
    private readonly logger: PinoLogger,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey, { apiVersion: '2024-04-10' });
    }
  }

  async getSubscription(orgId: string) {
    return this.prisma.subscription.findUnique({
      where: { organizationId: orgId },
      include: { plan: true, invoices: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
  }

  async getPlans() {
    return this.prisma.subscriptionPlan.findMany({
      where: { isActive: true, isPublic: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createCheckoutSession(orgId: string, planName: string, billingInterval: string): Promise<{ url: string }> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { name: planName } });
    if (!plan) throw new NotFoundException('Plan not found');

    const priceId = billingInterval === 'ANNUALLY' ? plan.stripePriceIdAnnual : plan.stripePriceIdMonthly;
    if (!priceId) throw new Error('Stripe price not configured for this plan');

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { billingEmail: true, name: true },
    });

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${this.configService.get('FRONTEND_URL')}/settings/billing?success=true`,
      cancel_url: `${this.configService.get('FRONTEND_URL')}/settings/billing?cancelled=true`,
      customer_email: org?.billingEmail ?? undefined,
      metadata: { organizationId: orgId, planName, billingInterval },
    });

    return { url: session.url ?? '' };
  }

  async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!this.stripe) return;

    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) return;

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err) {
      this.logger.error({ err }, 'Invalid Stripe webhook signature');
      throw err;
    }

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.syncSubscription(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionCancelled(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
    }
  }

  private async syncSubscription(stripeSubscription: Stripe.Subscription): Promise<void> {
    const orgId = stripeSubscription.metadata['organizationId'];
    const planName = stripeSubscription.metadata['planName'];
    if (!orgId || !planName) return;

    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { name: planName } });
    if (!plan) return;

    await this.prisma.subscription.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        planId: plan.id,
        status: stripeSubscription.status as 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELLED' | 'UNPAID' | 'INCOMPLETE' | 'INCOMPLETE_EXPIRED' | 'PAUSED',
        billingInterval: 'MONTHLY',
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        stripeCustomerId: stripeSubscription.customer as string,
        stripeSubscriptionId: stripeSubscription.id,
      },
      update: {
        status: stripeSubscription.status as 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELLED' | 'UNPAID' | 'INCOMPLETE' | 'INCOMPLETE_EXPIRED' | 'PAUSED',
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      },
    });
  }

  private async handleSubscriptionCancelled(stripeSubscription: Stripe.Subscription): Promise<void> {
    await this.prisma.subscription.updateMany({
      where: { stripeSubscriptionId: stripeSubscription.id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), endedAt: new Date() },
    });
  }

  private async handlePaymentSucceeded(_invoice: Stripe.Invoice): Promise<void> {
    // Update subscription status and record invoice
  }

  private async handlePaymentFailed(_invoice: Stripe.Invoice): Promise<void> {
    // Send payment failed notification
  }
}

import { Controller, Get, Post, Body, UseGuards, HttpCode, HttpStatus, Headers, RawBodyRequest, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PublicRoute } from '../auth/decorators/public.decorator';
import { BillingService } from './billing.service';
import type { AuthContext } from '@sentinelx/shared';
import { PERMISSIONS } from '@sentinelx/shared';

@ApiTags('Billing')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'billing', version: '1' })
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('plans')
  @PublicRoute()
  @ApiOperation({ summary: 'Get available subscription plans', operationId: 'getPlans' })
  getPlans() { return this.billingService.getPlans(); }

  @Get('subscription')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE_BILLING)
  @ApiOperation({ summary: 'Get current subscription', operationId: 'getSubscription' })
  getSubscription(@CurrentUser() user: AuthContext) {
    return this.billingService.getSubscription(user.organizationId);
  }

  @Post('checkout')
  @RequirePermissions(PERMISSIONS.ORG_MANAGE_BILLING)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create Stripe checkout session', operationId: 'createCheckout' })
  createCheckout(
    @Body() body: { planName: string; billingInterval: string },
    @CurrentUser() user: AuthContext,
  ) {
    return this.billingService.createCheckoutSession(user.organizationId, body.planName, body.billingInterval);
  }

  @Post('webhook')
  @PublicRoute()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    await this.billingService.handleWebhook(req.rawBody ?? Buffer.from(''), signature);
    return { received: true };
  }
}

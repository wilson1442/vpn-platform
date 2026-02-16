import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles, CurrentUser, Public } from '../../common/decorators';
import { StripeService } from './stripe.service';
import { PayPalService } from './paypal.service';
import { EntitlementService } from './entitlement.service';
import { PrismaService } from '../../common/prisma.service';

@Controller('checkout')
export class CheckoutController {
  constructor(
    private stripe: StripeService,
    private paypal: PayPalService,
    private entitlements: EntitlementService,
    private prisma: PrismaService,
  ) {}

  @Get('gateways')
  @Public()
  async getEnabledGateways() {
    const gateways = await this.prisma.paymentGateway.findMany({
      where: { isEnabled: true },
      select: { provider: true, displayName: true },
      orderBy: { provider: 'asc' },
    });
    return gateways;
  }

  @Post('stripe')
  @Roles(Role.ADMIN, Role.RESELLER, Role.USER)
  async createStripeCheckout(
    @Body() body: { packageId: string; successUrl: string; cancelUrl: string },
    @CurrentUser() actor: any,
  ) {
    if (!(await this.stripe.isConfigured())) {
      throw new BadRequestException('Stripe is not configured');
    }

    const pkg = await this.prisma.package.findUnique({ where: { id: body.packageId } });
    if (!pkg) throw new NotFoundException('Package not found');

    const session = await this.stripe.createCheckoutSession({
      ...(pkg.stripePriceId
        ? { priceId: pkg.stripePriceId }
        : { amount: pkg.priceMonthly, productName: pkg.name }),
      userId: actor.sub,
      packageId: pkg.id,
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
    });

    return { sessionId: session.id, url: session.url };
  }

  @Post('paypal')
  @Roles(Role.ADMIN, Role.RESELLER, Role.USER)
  async createPayPalOrder(
    @Body() body: { packageId: string; returnUrl: string; cancelUrl: string },
    @CurrentUser() actor: any,
  ) {
    if (!(await this.paypal.isConfigured())) {
      throw new BadRequestException('PayPal is not configured');
    }

    const pkg = await this.prisma.package.findUnique({ where: { id: body.packageId } });
    if (!pkg) throw new NotFoundException('Package not found');

    const order = await this.paypal.createOrder({
      amount: pkg.priceMonthly,
      userId: actor.sub,
      packageId: pkg.id,
      returnUrl: body.returnUrl,
      cancelUrl: body.cancelUrl,
      description: pkg.name,
    });

    return order;
  }

  @Post('paypal/:orderId/capture')
  @Roles(Role.ADMIN, Role.RESELLER, Role.USER)
  async capturePayPalOrder(
    @Param('orderId') orderId: string,
    @CurrentUser() actor: any,
  ) {
    if (!(await this.paypal.isConfigured())) {
      throw new BadRequestException('PayPal is not configured');
    }

    const result = await this.paypal.captureOrder(orderId);

    if (result.success && result.customId) {
      try {
        const meta = JSON.parse(result.customId);
        if (meta.userId && meta.packageId) {
          await this.entitlements.create(meta.userId, meta.packageId);
        }
      } catch {
        // customId parsing failed, skip entitlement
      }
    }

    return result;
  }
}

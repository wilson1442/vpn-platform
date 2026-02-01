import { Controller, Post, Req, Res, Logger, RawBodyRequest } from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '../../common/decorators';
import { StripeService } from './stripe.service';
import { EntitlementService } from './entitlement.service';
import { PrismaService } from '../../common/prisma.service';
import Stripe from 'stripe';

@Controller('billing')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private stripe: StripeService,
    private entitlements: EntitlementService,
    private prisma: PrismaService,
  ) {}

  @Public()
  @Post('webhook')
  async handleWebhook(@Req() req: RawBodyRequest<Request>, @Res() res: Response) {
    const signature = req.headers['stripe-signature'] as string;
    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    if (!this.stripe.isConfigured()) {
      return res.status(503).json({ error: 'Stripe not configured' });
    }

    let event: Stripe.Event;
    try {
      event = await this.stripe.constructWebhookEvent(req.rawBody!, signature);
    } catch (err: any) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    try {
      await this.processEvent(event);
    } catch (err: any) {
      this.logger.error(`Error processing webhook event ${event.type}: ${err.message}`);
      return res.status(500).json({ error: 'Internal processing error' });
    }

    return res.status(200).json({ received: true });
  }

  private async processEvent(event: Stripe.Event) {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await this.handleCheckoutCompleted(session);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        this.logger.log(`Invoice paid: ${invoice.id} for subscription ${invoice.subscription}`);
        // Subscription renewals — entitlement stays active, nothing to change
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await this.handleSubscriptionDeleted(sub);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        await this.handleSubscriptionUpdated(sub);
        break;
      }

      default:
        this.logger.log(`Unhandled webhook event type: ${event.type}`);
    }
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const subscriptionId = session.subscription as string;
    if (!subscriptionId) return;

    // Metadata should include userId and packageId set during checkout session creation
    const userId = session.metadata?.userId;
    const packageId = session.metadata?.packageId ?? session.metadata?.planId;

    if (!userId || !packageId) {
      this.logger.warn(`Checkout session ${session.id} missing userId/packageId metadata`);
      return;
    }

    const entitlement = await this.entitlements.create(userId, packageId);
    await this.prisma.entitlement.update({
      where: { id: entitlement.id },
      data: { stripeSubId: subscriptionId },
    });

    this.logger.log(`Activated entitlement ${entitlement.id} for user ${userId} via Stripe sub ${subscriptionId}`);
  }

  private async handleSubscriptionDeleted(sub: Stripe.Subscription) {
    const entitlement = await this.prisma.entitlement.findFirst({
      where: { stripeSubId: sub.id },
    });

    if (!entitlement) {
      this.logger.warn(`No entitlement found for subscription ${sub.id}`);
      return;
    }

    await this.entitlements.deactivate(entitlement.id);
    this.logger.log(`Deactivated entitlement ${entitlement.id} due to subscription cancellation`);
  }

  private async handleSubscriptionUpdated(sub: Stripe.Subscription) {
    const entitlement = await this.prisma.entitlement.findFirst({
      where: { stripeSubId: sub.id },
    });

    if (!entitlement) return;

    if (sub.status === 'active') {
      await this.entitlements.activate(entitlement.id);
    } else if (sub.status === 'past_due' || sub.status === 'unpaid' || sub.status === 'canceled') {
      await this.entitlements.deactivate(entitlement.id);
    }
  }
}

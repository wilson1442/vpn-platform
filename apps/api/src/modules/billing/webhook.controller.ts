import { Controller, Post, Req, Res, Logger, RawBodyRequest } from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '../../common/decorators';
import { StripeService } from './stripe.service';
import { PayPalService } from './paypal.service';
import { EntitlementService } from './entitlement.service';
import { PrismaService } from '../../common/prisma.service';
import Stripe from 'stripe';

@Controller('billing')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private stripe: StripeService,
    private paypal: PayPalService,
    private entitlements: EntitlementService,
    private prisma: PrismaService,
  ) {}

  // ─── Stripe Webhook ───────────────────────────────────

  @Public()
  @Post('webhook')
  async handleStripeWebhook(@Req() req: RawBodyRequest<Request>, @Res() res: Response) {
    const signature = req.headers['stripe-signature'] as string;
    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    if (!(await this.stripe.isConfigured())) {
      return res.status(503).json({ error: 'Stripe not configured' });
    }

    let event: Stripe.Event;
    try {
      event = await this.stripe.constructWebhookEvent(req.rawBody!, signature);
    } catch (err: any) {
      this.logger.error(`Stripe webhook signature verification failed: ${err.message}`);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    try {
      await this.processStripeEvent(event);
    } catch (err: any) {
      this.logger.error(`Error processing Stripe event ${event.type}: ${err.message}`);
      return res.status(500).json({ error: 'Internal processing error' });
    }

    return res.status(200).json({ received: true });
  }

  private async processStripeEvent(event: Stripe.Event) {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await this.handleStripeCheckoutCompleted(session);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        this.logger.log(`Invoice paid: ${invoice.id} for subscription ${invoice.subscription}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await this.handleStripeSubscriptionDeleted(sub);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        await this.handleStripeSubscriptionUpdated(sub);
        break;
      }

      default:
        this.logger.log(`Unhandled Stripe event: ${event.type}`);
    }
  }

  private async handleStripeCheckoutCompleted(session: Stripe.Checkout.Session) {
    const subscriptionId = session.subscription as string;
    if (!subscriptionId) return;

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

  private async handleStripeSubscriptionDeleted(sub: Stripe.Subscription) {
    const entitlement = await this.prisma.entitlement.findFirst({
      where: { stripeSubId: sub.id },
    });

    if (!entitlement) {
      this.logger.warn(`No entitlement found for Stripe subscription ${sub.id}`);
      return;
    }

    await this.entitlements.deactivate(entitlement.id);
    this.logger.log(`Deactivated entitlement ${entitlement.id} due to Stripe subscription cancellation`);
  }

  private async handleStripeSubscriptionUpdated(sub: Stripe.Subscription) {
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

  // ─── PayPal Webhook ───────────────────────────────────

  @Public()
  @Post('webhook/paypal')
  async handlePayPalWebhook(@Req() req: Request, @Res() res: Response) {
    if (!(await this.paypal.isConfigured())) {
      return res.status(503).json({ error: 'PayPal not configured' });
    }

    const event = req.body;
    if (!event?.event_type) {
      return res.status(400).json({ error: 'Invalid PayPal webhook payload' });
    }

    this.logger.log(`PayPal webhook received: ${event.event_type}`);

    try {
      await this.processPayPalEvent(event);
    } catch (err: any) {
      this.logger.error(`Error processing PayPal event ${event.event_type}: ${err.message}`);
      return res.status(500).json({ error: 'Internal processing error' });
    }

    return res.status(200).json({ received: true });
  }

  private async processPayPalEvent(event: any) {
    switch (event.event_type) {
      case 'CHECKOUT.ORDER.APPROVED': {
        const orderId = event.resource?.id;
        if (!orderId) break;
        this.logger.log(`PayPal order approved: ${orderId} — awaiting capture`);
        break;
      }

      case 'PAYMENT.CAPTURE.COMPLETED': {
        const capture = event.resource;
        const customId = capture?.custom_id;
        if (!customId) {
          this.logger.warn('PayPal capture completed without custom_id');
          break;
        }

        try {
          const meta = JSON.parse(customId);
          if (meta.userId && meta.packageId) {
            await this.entitlements.create(meta.userId, meta.packageId);
            this.logger.log(`Activated entitlement for user ${meta.userId} via PayPal capture ${capture.id}`);
          }
        } catch {
          this.logger.warn(`Failed to parse PayPal custom_id: ${customId}`);
        }
        break;
      }

      case 'PAYMENT.CAPTURE.REFUNDED': {
        this.logger.log(`PayPal capture refunded: ${event.resource?.id}`);
        break;
      }

      default:
        this.logger.log(`Unhandled PayPal event: ${event.event_type}`);
    }
  }
}

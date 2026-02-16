import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  private async getCredentials(): Promise<{ secretKey: string; publishableKey?: string; webhookSecret?: string } | null> {
    // Try DB config first
    const gw = await this.prisma.paymentGateway
      .findUnique({ where: { provider: 'stripe' } })
      .catch(() => null);

    if (gw?.isEnabled && (gw.config as any)?.secretKey) {
      const cfg = gw.config as any;
      return {
        secretKey: cfg.secretKey,
        publishableKey: cfg.publishableKey,
        webhookSecret: cfg.webhookSecret,
      };
    }

    // Fall back to env vars
    const key = this.config.get('STRIPE_SECRET_KEY');
    if (key && key !== 'sk_test_xxx') {
      return {
        secretKey: key,
        webhookSecret: this.config.get('STRIPE_WEBHOOK_SECRET'),
      };
    }

    return null;
  }

  private async getClient(): Promise<Stripe | null> {
    const creds = await this.getCredentials();
    if (!creds) return null;
    return new Stripe(creds.secretKey, { apiVersion: '2024-12-18.acacia' as any });
  }

  async createCheckoutSession(opts: {
    priceId?: string;
    amount?: number;
    currency?: string;
    productName?: string;
    userId: string;
    packageId: string;
    successUrl: string;
    cancelUrl: string;
    customerId?: string;
  }) {
    const stripe = await this.getClient();
    if (!stripe) throw new Error('Stripe not configured');

    const lineItems = opts.priceId
      ? [{ price: opts.priceId, quantity: 1 }]
      : [{
          price_data: {
            currency: opts.currency || 'usd',
            product_data: { name: opts.productName || 'VPN Package' },
            unit_amount: opts.amount!,
          },
          quantity: 1,
        }];

    return stripe.checkout.sessions.create({
      mode: opts.priceId ? 'subscription' : 'payment',
      line_items: lineItems,
      ...(opts.customerId ? { customer: opts.customerId } : {}),
      success_url: opts.successUrl,
      cancel_url: opts.cancelUrl,
      metadata: {
        userId: opts.userId,
        packageId: opts.packageId,
      },
    });
  }

  async constructWebhookEvent(payload: Buffer, signature: string) {
    const stripe = await this.getClient();
    if (!stripe) throw new Error('Stripe not configured');
    const creds = await this.getCredentials();
    if (!creds?.webhookSecret) throw new Error('Stripe webhook secret not configured');
    return stripe.webhooks.constructEvent(payload, signature, creds.webhookSecret);
  }

  async isConfigured(): Promise<boolean> {
    const creds = await this.getCredentials();
    return creds !== null;
  }
}

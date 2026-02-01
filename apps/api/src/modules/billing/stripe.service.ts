import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private stripe: Stripe | null = null;
  private readonly logger = new Logger(StripeService.name);

  constructor(private config: ConfigService) {
    const key = this.config.get('STRIPE_SECRET_KEY');
    if (key && key !== 'sk_test_xxx') {
      this.stripe = new Stripe(key, { apiVersion: '2024-12-18.acacia' as any });
    } else {
      this.logger.warn('Stripe not configured - billing features disabled');
    }
  }

  async createCheckoutSession(priceId: string, customerId: string, successUrl: string, cancelUrl: string) {
    if (!this.stripe) throw new Error('Stripe not configured');
    return this.stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer: customerId,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
  }

  async constructWebhookEvent(payload: Buffer, signature: string) {
    if (!this.stripe) throw new Error('Stripe not configured');
    const secret = this.config.get('STRIPE_WEBHOOK_SECRET');
    return this.stripe.webhooks.constructEvent(payload, signature, secret!);
  }

  isConfigured() {
    return this.stripe !== null;
  }
}

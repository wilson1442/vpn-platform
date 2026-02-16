import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import {
  Client,
  Environment,
  LogLevel,
  OrdersController,
  CheckoutPaymentIntent,
} from '@paypal/paypal-server-sdk';

@Injectable()
export class PayPalService {
  private readonly logger = new Logger(PayPalService.name);

  constructor(private prisma: PrismaService) {}

  private async getCredentials(): Promise<{
    clientId: string;
    clientSecret: string;
    mode: string;
    webhookId?: string;
  } | null> {
    const gw = await this.prisma.paymentGateway
      .findUnique({ where: { provider: 'paypal' } })
      .catch(() => null);

    if (!gw?.isEnabled) return null;

    const cfg = gw.config as any;
    if (!cfg?.clientId || !cfg?.clientSecret) return null;

    return {
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
      mode: cfg.mode || 'sandbox',
      webhookId: cfg.webhookId,
    };
  }

  private async getClient(): Promise<{ client: Client; orders: OrdersController } | null> {
    const creds = await this.getCredentials();
    if (!creds) return null;

    const client = new Client({
      clientCredentialsAuthCredentials: {
        oAuthClientId: creds.clientId,
        oAuthClientSecret: creds.clientSecret,
      },
      environment: creds.mode === 'live' ? Environment.Production : Environment.Sandbox,
      logging: {
        logLevel: LogLevel.Warn,
      },
    });

    return { client, orders: new OrdersController(client) };
  }

  async createOrder(opts: {
    amount: number; // in cents
    currency?: string;
    userId: string;
    packageId: string;
    returnUrl: string;
    cancelUrl: string;
    description?: string;
  }): Promise<{ orderId: string; approvalUrl: string }> {
    const pp = await this.getClient();
    if (!pp) throw new Error('PayPal not configured');

    const amountStr = (opts.amount / 100).toFixed(2);

    const { result } = await pp.orders.createOrder({
      body: {
        intent: CheckoutPaymentIntent.Capture,
        purchaseUnits: [
          {
            amount: {
              currencyCode: opts.currency || 'USD',
              value: amountStr,
            },
            description: opts.description || 'VPN Package',
            customId: JSON.stringify({ userId: opts.userId, packageId: opts.packageId }),
          },
        ],
        paymentSource: {
          paypal: {
            experienceContext: {
              returnUrl: opts.returnUrl,
              cancelUrl: opts.cancelUrl,
              brandName: 'VPN Platform',
              userAction: 'PAY_NOW' as any,
            },
          },
        },
      },
    });

    const approvalLink = result.links?.find((l: any) => l.rel === 'payer-action');
    if (!approvalLink?.href) {
      throw new Error('PayPal did not return approval URL');
    }

    return {
      orderId: result.id!,
      approvalUrl: approvalLink.href,
    };
  }

  async captureOrder(orderId: string): Promise<{
    success: boolean;
    captureId?: string;
    status?: string;
    customId?: string;
  }> {
    const pp = await this.getClient();
    if (!pp) throw new Error('PayPal not configured');

    const { result } = await pp.orders.captureOrder({ id: orderId });

    const capture = result.purchaseUnits?.[0]?.payments?.captures?.[0];
    const customId = result.purchaseUnits?.[0]?.customId;

    return {
      success: result.status === 'COMPLETED',
      captureId: capture?.id,
      status: result.status,
      customId,
    };
  }

  async getOrder(orderId: string) {
    const pp = await this.getClient();
    if (!pp) throw new Error('PayPal not configured');

    const { result } = await pp.orders.getOrder({ id: orderId });
    return result;
  }

  async isConfigured(): Promise<boolean> {
    const creds = await this.getCredentials();
    return creds !== null;
  }

  async getWebhookId(): Promise<string | null> {
    const creds = await this.getCredentials();
    return creds?.webhookId || null;
  }
}

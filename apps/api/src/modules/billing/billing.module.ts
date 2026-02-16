import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { PayPalService } from './paypal.service';
import { EntitlementService } from './entitlement.service';
import { CreditLedgerService } from './credit-ledger.service';
import { InvoiceService } from './invoice.service';
import { BillingController } from './billing.controller';
import { CheckoutController } from './checkout.controller';
import { WebhookController } from './webhook.controller';

@Module({
  providers: [StripeService, PayPalService, EntitlementService, CreditLedgerService, InvoiceService],
  controllers: [BillingController, CheckoutController, WebhookController],
  exports: [EntitlementService, CreditLedgerService, InvoiceService],
})
export class BillingModule {}

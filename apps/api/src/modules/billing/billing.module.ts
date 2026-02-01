import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { EntitlementService } from './entitlement.service';
import { CreditLedgerService } from './credit-ledger.service';
import { InvoiceService } from './invoice.service';
import { BillingController } from './billing.controller';
import { WebhookController } from './webhook.controller';

@Module({
  providers: [StripeService, EntitlementService, CreditLedgerService, InvoiceService],
  controllers: [BillingController, WebhookController],
  exports: [EntitlementService, CreditLedgerService, InvoiceService],
})
export class BillingModule {}

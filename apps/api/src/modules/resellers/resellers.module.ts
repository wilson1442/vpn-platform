import { Module } from '@nestjs/common';
import { ResellersService } from './resellers.service';
import { ResellersController } from './resellers.controller';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [BillingModule],
  providers: [ResellersService],
  controllers: [ResellersController],
  exports: [ResellersService],
})
export class ResellersModule {}

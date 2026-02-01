import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigDeliveryController } from './config-delivery.controller';
import { ConfigDeliveryService } from './config-delivery.service';
import { EmailWorker } from '../../workers/email.worker';
import { PkiModule } from '../pki/pki.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'email' }),
    PkiModule,
  ],
  providers: [ConfigDeliveryService, EmailWorker],
  controllers: [ConfigDeliveryController],
})
export class ConfigDeliveryModule {}

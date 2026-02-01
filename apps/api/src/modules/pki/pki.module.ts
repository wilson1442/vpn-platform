import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PkiService } from './pki.service';
import { PkiController } from './pki.controller';
import { CrlWorker } from '../../workers/crl.worker';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'crl-distribution' }),
  ],
  providers: [PkiService, CrlWorker],
  controllers: [PkiController],
  exports: [PkiService],
})
export class PkiModule {}

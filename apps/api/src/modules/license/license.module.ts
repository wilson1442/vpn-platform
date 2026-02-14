import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { LicenseService } from './license.service';
import { LicenseController } from './license.controller';
import { LicenseFeatureGuard } from './license.guard';

@Module({
  providers: [
    LicenseService,
    {
      provide: APP_GUARD,
      useClass: LicenseFeatureGuard,
    },
  ],
  controllers: [LicenseController],
  exports: [LicenseService],
})
export class LicenseModule {}

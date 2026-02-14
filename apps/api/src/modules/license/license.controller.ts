import { Controller, Get } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators';
import { LicenseService } from './license.service';

@Controller('license')
export class LicenseController {
  constructor(private licenseService: LicenseService) {}

  @Get('status')
  @Roles(Role.ADMIN)
  getStatus() {
    return this.licenseService.getStatus();
  }

  @Get('features')
  getFeatures() {
    return this.licenseService.getFeatures();
  }
}

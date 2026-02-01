import { Controller, Get, Post, Param, Body, Req } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PkiService } from './pki.service';
import { Roles, AgentAuth, CurrentUser } from '../../common/decorators';

@Controller('pki')
export class PkiController {
  constructor(private pki: PkiService) {}

  @Post('ca/init')
  @Roles(Role.ADMIN)
  initCA() {
    return this.pki.initCA();
  }

  @Get('ca')
  @Roles(Role.ADMIN)
  getCA() {
    return this.pki.getCA();
  }

  @Post('certificates')
  @Roles(Role.ADMIN, Role.RESELLER)
  issueCert(@Body() body: { userId: string; commonName: string }, @CurrentUser() actor: any) {
    return this.pki.issueCert(body.userId, body.commonName, actor);
  }

  @Post('certificates/:id/revoke')
  @Roles(Role.ADMIN, Role.RESELLER)
  revokeCert(@Param('id') id: string, @CurrentUser() actor: any) {
    return this.pki.revokeCert(id, actor);
  }

  @Get('crl')
  @AgentAuth()
  getCRL() {
    return this.pki.getCRL();
  }

  @Post('crl/regenerate')
  @Roles(Role.ADMIN)
  regenerateCRL() {
    return this.pki.regenerateCRL();
  }
}

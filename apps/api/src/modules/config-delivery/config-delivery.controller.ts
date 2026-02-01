import { Controller, Get, Post, Delete, Param, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { ConfigDeliveryService } from './config-delivery.service';
import { CurrentUser } from '../../common/decorators';

@Controller('configs')
export class ConfigDeliveryController {
  constructor(private configDelivery: ConfigDeliveryService) {}

  @Get('certificates')
  getUserCertificates(@CurrentUser() user: any) {
    return this.configDelivery.getUserCertificates(user.sub);
  }

  @Get('nodes')
  getAvailableNodes() {
    return this.configDelivery.getAvailableNodes();
  }

  @Get('nodes/:vpnNodeId/download')
  async downloadNodeProfile(
    @Param('vpnNodeId') vpnNodeId: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const config = await this.configDelivery.getNodeProfile(vpnNodeId, user.sub);
    res.setHeader('Content-Type', 'application/x-openvpn-profile');
    res.setHeader('Content-Disposition', 'attachment; filename="vpn.ovpn"');
    res.send(config);
  }

  @Post('generate')
  async generateConfig(
    @CurrentUser() user: any,
    @Body() body: { deviceName: string; vpnNodeId: string },
  ) {
    return this.configDelivery.generateConfig(user.sub, body.deviceName, body.vpnNodeId);
  }

  @Get(':certId/download/:vpnNodeId')
  async download(
    @Param('certId') certId: string,
    @Param('vpnNodeId') vpnNodeId: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    await this.configDelivery.assertCertOwnership(certId, user.sub);
    const config = await this.configDelivery.downloadConfig(certId, vpnNodeId);
    res.setHeader('Content-Type', 'application/x-openvpn-profile');
    res.setHeader('Content-Disposition', 'attachment; filename="client.ovpn"');
    res.send(config);
  }

  @Post(':certId/email/:vpnNodeId')
  async emailConfig(
    @Param('certId') certId: string,
    @Param('vpnNodeId') vpnNodeId: string,
    @CurrentUser() user: any,
    @Body() body: { email: string },
  ) {
    await this.configDelivery.assertCertOwnership(certId, user.sub);
    return this.configDelivery.emailConfig(certId, vpnNodeId, body.email);
  }

  @Delete('certificates/:certId')
  async deleteCertificate(
    @Param('certId') certId: string,
    @CurrentUser() user: any,
  ) {
    await this.configDelivery.assertCertOwnership(certId, user.sub);
    return this.configDelivery.deleteCertificate(certId);
  }
}

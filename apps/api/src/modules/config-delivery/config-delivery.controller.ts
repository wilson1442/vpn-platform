import { Controller, Get, Post, Delete, Param, Body, Res, Query, Req } from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigDeliveryService } from './config-delivery.service';
import { CurrentUser, Public } from '../../common/decorators';

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

  @Get('access-token')
  getAccessToken(@CurrentUser() user: any) {
    return this.configDelivery.getOrCreateAccessToken(user.sub);
  }

  @Post('access-token/regenerate')
  regenerateAccessToken(@CurrentUser() user: any) {
    return this.configDelivery.regenerateAccessToken(user.sub);
  }

  @Public()
  @Get('profile/:token')
  async getProfileByToken(
    @Param('token') token: string,
    @Query('node') nodeId: string | undefined,
    @Res() res: Response,
  ) {
    const { config, nodeName } = await this.configDelivery.getProfileByToken(token, nodeId);
    res.setHeader('Content-Type', 'application/x-openvpn-profile');
    res.setHeader('Content-Disposition', `attachment; filename="${nodeName}.ovpn"`);
    res.send(config);
  }

  @Get('short-urls')
  getShortUrls(@CurrentUser() user: any) {
    return this.configDelivery.getShortUrls(user.sub);
  }

  @Post('short-urls/all')
  getOrCreateAllShortUrls(
    @CurrentUser() user: any,
    @Req() req: Request,
  ) {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return this.configDelivery.getOrCreateAllShortUrls(user.sub, baseUrl);
  }

  @Post('short-url/:vpnNodeId')
  getOrCreateShortUrl(
    @CurrentUser() user: any,
    @Param('vpnNodeId') vpnNodeId: string,
    @Req() req: Request,
  ) {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return this.configDelivery.getOrCreateShortUrl(user.sub, vpnNodeId, baseUrl);
  }

  @Post('short-url/:vpnNodeId/regenerate')
  regenerateShortUrl(
    @CurrentUser() user: any,
    @Param('vpnNodeId') vpnNodeId: string,
    @Req() req: Request,
  ) {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return this.configDelivery.regenerateShortUrl(user.sub, vpnNodeId, baseUrl);
  }

  @Public()
  @Get('p/:code')
  async getProfileByShortCode(
    @Param('code') code: string,
    @Res() res: Response,
  ) {
    const { config, nodeName } = await this.configDelivery.getProfileByShortCode(code);
    res.setHeader('Content-Type', 'application/x-openvpn-profile');
    res.setHeader('Content-Disposition', `attachment; filename="${nodeName}.ovpn"`);
    res.send(config);
  }
}

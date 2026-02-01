import { Controller, Get, Post, Param, Body, Query, Req } from '@nestjs/common';
import { Role } from '@prisma/client';
import { SessionsService } from './sessions.service';
import { Roles, AgentAuth, CurrentUser } from '../../common/decorators';

@Controller('sessions')
export class SessionsController {
  constructor(private sessions: SessionsService) {}

  @Post('vpn-auth')
  @AgentAuth()
  vpnAuth(@Body() body: { username: string; password: string }) {
    return this.sessions.vpnAuth(body.username, body.password);
  }

  @Post('connect')
  @AgentAuth()
  connect(@Req() req: any, @Body() body: { commonName: string; realAddress: string }) {
    return this.sessions.connect({
      commonName: body.commonName,
      realAddress: body.realAddress,
      vpnNodeId: req.vpnNode.id,
    });
  }

  @Post('disconnect')
  @AgentAuth()
  disconnect(@Req() req: any, @Body() body: { commonName: string; bytesReceived?: number; bytesSent?: number }) {
    return this.sessions.disconnect({
      commonName: body.commonName,
      vpnNodeId: req.vpnNode.id,
      bytesReceived: body.bytesReceived,
      bytesSent: body.bytesSent,
    });
  }

  @Post(':id/kick')
  @Roles(Role.ADMIN, Role.RESELLER)
  kick(@Param('id') id: string, @CurrentUser() actor: any) {
    return this.sessions.manualKick(id, actor);
  }

  @Get()
  @Roles(Role.ADMIN, Role.RESELLER)
  findAll(@CurrentUser() actor: any, @Query('userId') userId?: string, @Query('vpnNodeId') vpnNodeId?: string, @Query('active') active?: string) {
    return this.sessions.findAll({
      userId,
      vpnNodeId,
      active: active === 'true',
    }, actor);
  }

  @Post('cleanup')
  @Roles(Role.ADMIN)
  cleanup() {
    return this.sessions.cleanupStaleSessions();
  }
}

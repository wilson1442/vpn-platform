import { Controller, Get, Post, Patch, Delete, Param, Body, Req, Sse, BadRequestException, MessageEvent } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Observable } from 'rxjs';
import { VpnNodesService } from './vpn-nodes.service';
import { NodeInstallerService, SshConfig } from './node-installer.service';
import { Roles, AgentAuth, Public } from '../../common/decorators';

@Controller('vpn-nodes')
export class VpnNodesController {
  constructor(
    private vpnNodes: VpnNodesService,
    private installer: NodeInstallerService,
  ) {}

  @Get()
  @Roles(Role.ADMIN)
  findAll() {
    return this.vpnNodes.findAll();
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  findOne(@Param('id') id: string) {
    return this.vpnNodes.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() body: { name: string; hostname: string; port?: number; agentPort?: number; mgmtPort?: number; sshPort?: number }) {
    return this.vpnNodes.create(body);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() body: any) {
    return this.vpnNodes.update(id, body);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  delete(@Param('id') id: string) {
    return this.vpnNodes.delete(id);
  }

  @Post('heartbeat')
  @AgentAuth()
  heartbeat(
    @Req() req: any,
    @Body()
    body: {
      crlVersion: number;
      activeConnections: number;
      cpuPercent?: number;
      memPercent?: number;
      netRxBps?: number;
      netTxBps?: number;
      totalBytesRx?: number;
      totalBytesTx?: number;
    },
  ) {
    return this.vpnNodes.heartbeat(req.vpnNode.id, body);
  }

  @Post(':id/install')
  @Roles(Role.ADMIN)
  async installNode(
    @Param('id') id: string,
    @Body() body: { host: string; sshPort?: number; username?: string; password?: string; privateKey?: string },
  ) {
    await this.vpnNodes.findOne(id);
    const sshConfig: SshConfig = {
      host: body.host,
      port: body.sshPort,
      username: body.username,
      password: body.password,
      privateKey: body.privateKey,
    };
    const jobId = this.installer.install(id, sshConfig);
    return { jobId };
  }

  @Public()
  @Sse(':id/install/logs/:jobId')
  installLogs(@Param('jobId') jobId: string): Observable<MessageEvent> {
    return this.createLogStream(jobId);
  }

  @Post(':id/restart')
  @Roles(Role.ADMIN)
  async restartNode(
    @Param('id') id: string,
    @Body() body: { host?: string; sshPort?: number; username?: string; password?: string; privateKey?: string },
  ) {
    const node = await this.vpnNodes.findOne(id);
    const sshConfig: SshConfig = {
      host: body.host || node.hostname,
      port: body.sshPort || node.sshPort,
      username: body.username,
      password: body.password,
      privateKey: body.privateKey,
    };
    const jobId = this.installer.restart(id, sshConfig);
    return { jobId };
  }

  @Public()
  @Sse(':id/restart/logs/:jobId')
  restartLogs(@Param('jobId') jobId: string): Observable<MessageEvent> {
    return this.createLogStream(jobId);
  }

  @Post(':id/reinstall')
  @Roles(Role.ADMIN)
  async reinstallNode(
    @Param('id') id: string,
    @Body() body: { host?: string; sshPort?: number; username?: string; password?: string; privateKey?: string },
  ) {
    const node = await this.vpnNodes.findOne(id);
    const sshConfig: SshConfig = {
      host: body.host || node.hostname,
      port: body.sshPort || node.sshPort,
      username: body.username,
      password: body.password,
      privateKey: body.privateKey,
    };
    const jobId = this.installer.reinstall(id, sshConfig);
    return { jobId };
  }

  @Public()
  @Sse(':id/reinstall/logs/:jobId')
  reinstallLogs(@Param('jobId') jobId: string): Observable<MessageEvent> {
    return this.createLogStream(jobId);
  }

  private createLogStream(jobId: string): Observable<MessageEvent> {
    const job = this.installer.getJob(jobId);
    if (!job) {
      throw new BadRequestException('Job not found');
    }

    return new Observable<MessageEvent>((subscriber) => {
      const onLog = (message: string) => {
        subscriber.next({ data: { type: 'log', message } } as MessageEvent);
      };
      const onStatus = (status: string) => {
        subscriber.next({ data: { type: 'status', status } } as MessageEvent);
        // Give client time to receive the status before completing
        setTimeout(() => subscriber.complete(), 500);
      };

      job.emitter.on('log', onLog);
      job.emitter.on('status', onStatus);

      // If job already finished, send final status
      if (job.status !== 'running') {
        subscriber.next({ data: { type: 'status', status: job.status } } as MessageEvent);
        setTimeout(() => subscriber.complete(), 500);
      }

      return () => {
        job.emitter.off('log', onLog);
        job.emitter.off('status', onStatus);
      };
    });
  }
}

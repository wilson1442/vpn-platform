import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class VpnNodesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.vpnNode.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const node = await this.prisma.vpnNode.findUnique({ where: { id } });
    if (!node) throw new NotFoundException('VPN node not found');
    return node;
  }

  create(data: { name: string; hostname: string; port?: number; agentPort?: number; mgmtPort?: number; sshPort?: number }) {
    return this.prisma.vpnNode.create({ data });
  }

  async update(id: string, data: { name?: string; hostname?: string; port?: number; agentPort?: number; mgmtPort?: number; isActive?: boolean }) {
    return this.prisma.vpnNode.update({ where: { id }, data });
  }

  async delete(id: string) {
    const node = await this.prisma.vpnNode.findUnique({ where: { id } });
    if (!node) throw new NotFoundException('VPN node not found');
    await this.prisma.vpnNode.delete({ where: { id } });
    return { deleted: true };
  }

  async heartbeat(nodeId: string, crlVersion: number, activeConnections: number) {
    return this.prisma.vpnNode.update({
      where: { id: nodeId },
      data: { lastHeartbeatAt: new Date(), crlVersion },
    });
  }

  async getStaleNodes(thresholdMs: number = 90_000) {
    const threshold = new Date(Date.now() - thresholdMs);
    return this.prisma.vpnNode.findMany({
      where: {
        isActive: true,
        OR: [
          { lastHeartbeatAt: null },
          { lastHeartbeatAt: { lt: threshold } },
        ],
      },
    });
  }
}

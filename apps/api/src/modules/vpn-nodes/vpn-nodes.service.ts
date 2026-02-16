import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { StatsService } from '../stats/stats.service';
import { SessionsService } from '../sessions/sessions.service';

@Injectable()
export class VpnNodesService {
  private readonly logger = new Logger(VpnNodesService.name);

  constructor(
    private prisma: PrismaService,
    private stats: StatsService,
    private sessions: SessionsService,
  ) {}

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

  async update(id: string, data: { name?: string; hostname?: string; port?: number; agentPort?: number; mgmtPort?: number; sshPort?: number; isActive?: boolean }) {
    return this.prisma.vpnNode.update({ where: { id }, data });
  }

  async delete(id: string) {
    const node = await this.prisma.vpnNode.findUnique({ where: { id } });
    if (!node) throw new NotFoundException('VPN node not found');
    await this.prisma.vpnNode.delete({ where: { id } });
    return { deleted: true };
  }

  async heartbeat(
    nodeId: string,
    data: {
      crlVersion: number;
      activeConnections: number;
      cpuPercent?: number;
      memPercent?: number;
      netRxBps?: number;
      netTxBps?: number;
      totalBytesRx?: number;
      totalBytesTx?: number;
      connectedClients?: (string | { commonName: string; realAddress?: string; connectedSinceEpoch?: number })[];
    },
  ) {
    const node = await this.prisma.vpnNode.update({
      where: { id: nodeId },
      data: { lastHeartbeatAt: new Date(), crlVersion: data.crlVersion },
    });

    this.stats.updateNodeMetrics(nodeId, node.name, node.hostname, node.isActive, {
      activeConnections: data.activeConnections,
      cpuPercent: data.cpuPercent,
      memPercent: data.memPercent,
      netRxBps: data.netRxBps,
      netTxBps: data.netTxBps,
      totalBytesRx: data.totalBytesRx,
      totalBytesTx: data.totalBytesTx,
    });

    // Sync sessions using the best available data:
    // 1. If connectedClients list has entries → precise sync (remove ghosts, create missing)
    // 2. If activeConnections === 0 → all sessions on this node are ghosts, clean them up
    // 3. Otherwise (no client list, but activeConnections > 0) → can't determine which
    //    sessions are real, so leave them alone
    const hasClientList = Array.isArray(data.connectedClients) && data.connectedClients.length > 0;

    if (hasClientList) {
      try {
        const clients = data.connectedClients!.map((c) =>
          typeof c === 'string'
            ? { commonName: c, realAddress: 'unknown', connectedSinceEpoch: 0 }
            : { commonName: c.commonName, realAddress: c.realAddress || 'unknown', connectedSinceEpoch: c.connectedSinceEpoch || 0 },
        );
        await this.sessions.syncSessions(nodeId, clients);
      } catch (err) {
        this.logger.error(`Session sync failed for node ${nodeId}: ${err}`);
      }
    } else if (data.activeConnections === 0) {
      // Node reports zero connections — mark all DB sessions for this node as disconnected
      try {
        await this.sessions.syncSessions(nodeId, []);
      } catch (err) {
        this.logger.error(`Session sync failed for node ${nodeId}: ${err}`);
      }
    }

    return node;
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

import { Injectable, ForbiddenException, NotFoundException, UnauthorizedException, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../common/prisma.service';
import { getResellerSubtreeIds } from '../../common/reseller-scope.util';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(private prisma: PrismaService) {}

  async vpnAuth(username: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: { entitlement: true },
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');
    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    if (!user.isActive) throw new ForbiddenException('User inactive');
    if (user.expiresAt && user.expiresAt < new Date()) throw new ForbiddenException('Account expired');
    if (!user.entitlement?.isActive) throw new ForbiddenException('No active entitlement');

    return { ok: true, username: user.username };
  }

  async connect(data: { commonName: string; realAddress: string; vpnNodeId: string }) {
    // commonName now holds the username (via username-as-common-name)
    const user = await this.prisma.user.findUnique({
      where: { username: data.commonName },
      include: { entitlement: { include: { package: true } } },
    });

    if (!user) throw new ForbiddenException('User not found');
    if (!user.isActive) throw new ForbiddenException('User inactive');
    if (user.expiresAt && user.expiresAt < new Date()) throw new ForbiddenException('Account expired');
    if (!user.entitlement?.isActive) throw new ForbiddenException('No active entitlement');

    const maxConnections = user.entitlement.maxConnections;

    // Use serializable transaction with row-level locking
    return this.prisma.$transaction(async (tx) => {
      // Lock user row
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;

      const activeSessions = await tx.vpnSession.findMany({
        where: { userId: user.id, disconnectedAt: null },
        orderBy: { connectedAt: 'asc' },
      });

      if (activeSessions.length >= maxConnections) {
        // Kick oldest session
        const oldest = activeSessions[0];
        await this.kickSession(oldest.id, oldest.vpnNodeId, oldest.commonName, 'concurrency');
      }

      return tx.vpnSession.create({
        data: {
          userId: user.id,
          vpnNodeId: data.vpnNodeId,
          certificateId: null,
          commonName: data.commonName,
          realAddress: data.realAddress,
        },
      });
    }, { isolationLevel: 'Serializable' });
  }

  async disconnect(data: { commonName: string; vpnNodeId: string; bytesReceived?: number; bytesSent?: number }) {
    const session = await this.prisma.vpnSession.findFirst({
      where: {
        commonName: data.commonName,
        vpnNodeId: data.vpnNodeId,
        disconnectedAt: null,
      },
      orderBy: { connectedAt: 'desc' },
    });

    if (!session) return { ok: true };

    return this.prisma.vpnSession.update({
      where: { id: session.id },
      data: {
        disconnectedAt: new Date(),
        bytesReceived: data.bytesReceived ?? 0,
        bytesSent: data.bytesSent ?? 0,
      },
    });
  }

  async kickSession(sessionId: string, vpnNodeId: string, commonName: string, reason: string) {
    const node = await this.prisma.vpnNode.findUnique({ where: { id: vpnNodeId } });
    if (!node) return;

    try {
      const url = `http://${node.hostname}:${node.agentPort}/kick`;
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${node.agentToken}`,
        },
        body: JSON.stringify({ commonName }),
      });
    } catch (err) {
      this.logger.error(`Kick failed for ${commonName} on ${node.name}: ${err}`);
    }

    await this.prisma.vpnSession.update({
      where: { id: sessionId },
      data: { disconnectedAt: new Date(), kickedReason: reason },
    });
  }

  async manualKick(sessionId: string, actor: { sub: string; role: string }) {
    const session = await this.prisma.vpnSession.findUnique({
      where: { id: sessionId },
      include: { user: { select: { resellerId: true } } },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.disconnectedAt) throw new ForbiddenException('Session already disconnected');
    await this.assertScope(actor, session.user.resellerId);
    await this.kickSession(session.id, session.vpnNodeId, session.commonName, 'manual');
    return { kicked: true };
  }

  async findAll(filters: { userId?: string; vpnNodeId?: string; active?: boolean }, actor: { sub: string; role: string }) {
    const where: any = {};
    if (filters.userId) where.userId = filters.userId;
    if (filters.vpnNodeId) where.vpnNodeId = filters.vpnNodeId;
    if (filters.active) where.disconnectedAt = null;

    // Scope to reseller's users
    if (actor.role !== 'ADMIN') {
      const reseller = await this.prisma.reseller.findUnique({ where: { userId: actor.sub } });
      if (!reseller) throw new ForbiddenException();
      const subtreeIds = await getResellerSubtreeIds(this.prisma, reseller.id);
      where.user = { resellerId: { in: subtreeIds } };
    }

    return this.prisma.vpnSession.findMany({
      where,
      include: { user: { select: { email: true } }, vpnNode: { select: { name: true } } },
      orderBy: { connectedAt: 'desc' },
      take: 200,
    });
  }

  private async assertScope(actor: { sub: string; role: string }, targetResellerId: string | null) {
    if (actor.role === 'ADMIN') return;
    const reseller = await this.prisma.reseller.findUnique({ where: { userId: actor.sub } });
    if (!reseller) throw new ForbiddenException();
    if (!targetResellerId) throw new ForbiddenException();
    const subtreeIds = await getResellerSubtreeIds(this.prisma, reseller.id);
    if (!subtreeIds.includes(targetResellerId)) {
      throw new ForbiddenException();
    }
  }

  async syncSessions(vpnNodeId: string, connectedClients: string[]) {
    const activeSessions = await this.prisma.vpnSession.findMany({
      where: { vpnNodeId, disconnectedAt: null },
    });

    const connectedSet = new Set(connectedClients);
    const ghostSessions = activeSessions.filter(
      (s) => !connectedSet.has(s.commonName),
    );

    if (ghostSessions.length > 0) {
      await this.prisma.vpnSession.updateMany({
        where: { id: { in: ghostSessions.map((s) => s.id) } },
        data: { disconnectedAt: new Date(), kickedReason: 'sync' },
      });
      this.logger.log(
        `Synced ${ghostSessions.length} ghost session(s) on node ${vpnNodeId}`,
      );
    }
  }

  async cleanupStaleSessions() {
    // Mark sessions as disconnected if their node hasn't sent a heartbeat in 5 minutes
    const threshold = new Date(Date.now() - 5 * 60 * 1000);
    const staleNodes = await this.prisma.vpnNode.findMany({
      where: {
        OR: [
          { lastHeartbeatAt: null },
          { lastHeartbeatAt: { lt: threshold } },
        ],
      },
    });

    if (staleNodes.length === 0) return { cleaned: 0 };

    const result = await this.prisma.vpnSession.updateMany({
      where: {
        vpnNodeId: { in: staleNodes.map((n) => n.id) },
        disconnectedAt: null,
      },
      data: { disconnectedAt: new Date(), kickedReason: 'stale_cleanup' },
    });

    return { cleaned: result.count };
  }
}

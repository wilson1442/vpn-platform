import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(data: {
    actorId?: string;
    action: string;
    targetType?: string;
    targetId?: string;
    metadata?: any;
    ipAddress?: string;
  }) {
    return this.prisma.auditLog.create({ data });
  }

  async deleteAll() {
    return this.prisma.auditLog.deleteMany({});
  }

  async purgeHeartbeatLogs() {
    const result = await this.prisma.auditLog.deleteMany({
      where: { action: { contains: 'heartbeat' } },
    });
    if (result.count > 0) {
      console.log(`Purged ${result.count} heartbeat entries from audit log`);
    }
    return result;
  }

  async findAll(filters: { action?: string; actorId?: string; limit?: number }) {
    return this.prisma.auditLog.findMany({
      where: {
        ...(filters.action && { action: filters.action }),
        ...(filters.actorId && { actorId: filters.actorId }),
      },
      include: { actor: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      take: filters.limit || 100,
    });
  }

  async findUserLogs(filters: { actorId?: string; limit?: number; offset?: number }) {
    const where = {
      OR: [
        { action: { startsWith: 'POST /users' } },
        { action: { startsWith: 'PATCH /users' } },
        { action: { startsWith: 'DELETE /users' } },
      ],
      ...(filters.actorId && { actorId: filters.actorId }),
    };

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { email: true, username: true } } },
        orderBy: { createdAt: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total };
  }
}

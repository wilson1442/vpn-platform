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
}

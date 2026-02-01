import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class EntitlementService {
  constructor(private prisma: PrismaService) {}

  private addDuration(base: Date, duration: string): Date | null {
    switch (duration) {
      case '24h': return new Date(base.getTime() + 24 * 60 * 60 * 1000);
      case '48h': return new Date(base.getTime() + 48 * 60 * 60 * 1000);
      case '1m':  { const d = new Date(base); d.setMonth(d.getMonth() + 1); return d; }
      case '3m':  { const d = new Date(base); d.setMonth(d.getMonth() + 3); return d; }
      case '6m':  { const d = new Date(base); d.setMonth(d.getMonth() + 6); return d; }
      case '12m': { const d = new Date(base); d.setMonth(d.getMonth() + 12); return d; }
      default: return null;
    }
  }

  private computeExpiresAt(duration: string): Date | null {
    return this.addDuration(new Date(), duration);
  }

  async create(userId: string, packageId: string) {
    const pkg = await this.prisma.package.findUnique({ where: { id: packageId } });
    if (!pkg) throw new NotFoundException('Package not found');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.entitlementId) throw new BadRequestException('User already has an entitlement');

    const entitlement = await this.prisma.entitlement.create({
      data: {
        packageId,
        maxConnections: pkg.maxConnections,
        maxDevices: pkg.maxDevices,
        isActive: true,
      },
    });

    const expiresAt = this.computeExpiresAt(pkg.duration);

    await this.prisma.user.update({
      where: { id: userId },
      data: { entitlementId: entitlement.id, ...(expiresAt ? { expiresAt } : {}) },
    });

    return entitlement;
  }

  async deactivate(entitlementId: string) {
    return this.prisma.entitlement.update({
      where: { id: entitlementId },
      data: { isActive: false },
    });
  }

  async activate(entitlementId: string) {
    return this.prisma.entitlement.update({
      where: { id: entitlementId },
      data: { isActive: true },
    });
  }

  async extend(userId: string, packageId: string) {
    const pkg = await this.prisma.package.findUnique({ where: { id: packageId } });
    if (!pkg) throw new NotFoundException('Package not found');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { entitlement: true },
    });
    if (!user) throw new NotFoundException('User not found');

    // Remove old entitlement if exists
    if (user.entitlementId) {
      await this.prisma.user.update({ where: { id: userId }, data: { entitlementId: null } });
      await this.prisma.entitlement.delete({ where: { id: user.entitlementId } });
    }

    // Create new entitlement
    const entitlement = await this.prisma.entitlement.create({
      data: {
        packageId,
        maxConnections: pkg.maxConnections,
        maxDevices: pkg.maxDevices,
        isActive: true,
      },
    });

    // Compute new expiration: from the later of (current expiresAt, now) + package duration
    const now = new Date();
    const base = user.expiresAt && user.expiresAt > now ? user.expiresAt : now;
    const expiresAt = this.addDuration(base, pkg.duration);

    await this.prisma.user.update({
      where: { id: userId },
      data: { entitlementId: entitlement.id, ...(expiresAt ? { expiresAt } : {}) },
    });

    return { entitlement, expiresAt };
  }

  async findByUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { entitlement: { include: { package: true } } },
    });
    return user?.entitlement ?? null;
  }
}

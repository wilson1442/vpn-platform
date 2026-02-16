import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { Role } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { getResellerSubtreeIds } from '../../common/reseller-scope.util';
import { EntitlementService } from '../billing/entitlement.service';
import { CreditLedgerService } from '../billing/credit-ledger.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService, private entitlementService: EntitlementService, private creditLedgerService: CreditLedgerService) {}

  async findAll(actor: { sub: string; role: string; resellerId?: string }) {
    const where = await this.buildScopeWhere(actor);
    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        resellerId: true,
        isActive: true,
        expiresAt: true,
        createdAt: true,
        entitlementId: true,
        entitlement: { select: { maxConnections: true, package: { select: { name: true } } } },
        reseller: { select: { companyName: true, user: { select: { username: true } } } },
        shortUrls: { select: { code: true, shortUrl: true, vpnNode: { select: { name: true } } } },
        _count: { select: { vpnSessions: { where: { disconnectedAt: null } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, actor: { sub: string; role: string; resellerId?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true, email: true, role: true, resellerId: true, isActive: true, expiresAt: true, createdAt: true, entitlementId: true, entitlement: { select: { package: { select: { name: true } } } } },
    });
    if (!user) throw new NotFoundException('User not found');
    await this.assertScope(actor, user);
    return user;
  }

  async create(data: { username: string; email?: string; password: string; role: Role; resellerId?: string; packageId?: string; expiresAt?: string }, actor: { sub: string; role: string; resellerId?: string }) {
    if (actor.role === 'RESELLER' && data.role === 'ADMIN') {
      throw new ForbiddenException('Resellers cannot create admins');
    }

    let resellerId = data.resellerId;
    if (actor.role === 'RESELLER') {
      // Resellers must assign users to their own subtree
      const reseller = await this.prisma.reseller.findUnique({ where: { userId: actor.sub } });
      if (!reseller) throw new ForbiddenException('Reseller profile not found');
      if (resellerId) {
        // Verify the target reseller is within the actor's subtree
        const subtreeIds = await getResellerSubtreeIds(this.prisma, reseller.id);
        if (!subtreeIds.includes(resellerId)) {
          throw new ForbiddenException('Cannot assign user to a reseller outside your subtree');
        }
      } else {
        // Default to the actor's own reseller
        resellerId = reseller.id;
      }
    }

    const passwordHash = await argon2.hash(data.password);
    const user = await this.prisma.user.create({
      data: { username: data.username, email: data.email || null, passwordHash, role: data.role, resellerId, expiresAt: data.expiresAt ? new Date(data.expiresAt) : null },
      select: { id: true, username: true, email: true, role: true, resellerId: true, isActive: true, expiresAt: true, createdAt: true },
    });

    if (data.packageId) {
      await this.deductCreditsIfReseller(actor, data.packageId);
      await this.entitlementService.create(user.id, data.packageId);
      // Re-fetch to get updated expiresAt and entitlement
      return this.prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, username: true, email: true, role: true, resellerId: true, isActive: true, expiresAt: true, createdAt: true, entitlementId: true, entitlement: { select: { package: { select: { name: true } } } } },
      });
    }

    return user;
  }

  async update(id: string, data: { username?: string; email?: string; password?: string; role?: Role; isActive?: boolean; expiresAt?: string | null; maxConnections?: number }, actor: { sub: string; role: string; resellerId?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    await this.assertScope(actor, user);

    const updateData: any = {};
    if (data.username) updateData.username = data.username;
    if (data.email) updateData.email = data.email;
    if (data.password) updateData.passwordHash = await argon2.hash(data.password);
    if (data.role) updateData.role = data.role;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;

    if (data.maxConnections !== undefined && user.entitlementId) {
      await this.prisma.entitlement.update({
        where: { id: user.entitlementId },
        data: { maxConnections: data.maxConnections },
      });
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, username: true, email: true, role: true, resellerId: true, isActive: true, expiresAt: true, createdAt: true },
    });
  }

  async extend(id: string, packageId: string, actor: { sub: string; role: string; resellerId?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    await this.assertScope(actor, user);
    await this.deductCreditsIfReseller(actor, packageId);
    return this.entitlementService.extend(id, packageId);
  }

  async delete(id: string, actor: { sub: string; role: string; resellerId?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    await this.assertScope(actor, user);
    await this.prisma.user.delete({ where: { id } });
    return { deleted: true };
  }

  private async deductCreditsIfReseller(actor: { sub: string; role: string; resellerId?: string }, packageId: string) {
    if (actor.role !== 'RESELLER') return;
    const pkg = await this.prisma.package.findUnique({ where: { id: packageId } });
    if (!pkg || pkg.creditCost <= 0) return;
    const reseller = await this.prisma.reseller.findUnique({ where: { userId: actor.sub } });
    if (!reseller) throw new ForbiddenException();
    await this.creditLedgerService.deductCredits(reseller.id, pkg.creditCost, `Package: ${pkg.name} assigned to user`);
  }

  private async buildScopeWhere(actor: { sub: string; role: string; resellerId?: string }) {
    if (actor.role === 'ADMIN') return {};
    if (actor.role === 'RESELLER') {
      const reseller = await this.prisma.reseller.findUnique({ where: { userId: actor.sub } });
      if (!reseller) throw new ForbiddenException('Reseller profile not found');
      const subtreeIds = await getResellerSubtreeIds(this.prisma, reseller.id);
      return { resellerId: { in: subtreeIds } };
    }
    return { id: actor.sub };
  }

  private async assertScope(actor: { sub: string; role: string; resellerId?: string }, target: { id: string; resellerId?: string | null }) {
    if (actor.role === 'ADMIN') return;
    if (actor.role === 'USER' && target.id !== actor.sub) {
      throw new ForbiddenException();
    }
    if (actor.role === 'RESELLER') {
      const reseller = await this.prisma.reseller.findUnique({ where: { userId: actor.sub } });
      if (!reseller) throw new ForbiddenException();
      const subtreeIds = await getResellerSubtreeIds(this.prisma, reseller.id);
      if (!target.resellerId || !subtreeIds.includes(target.resellerId)) {
        throw new ForbiddenException();
      }
    }
  }
}

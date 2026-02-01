import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { getResellerSubtreeIds } from '../../common/reseller-scope.util';
import { CreditLedgerService } from '../billing/credit-ledger.service';

@Injectable()
export class ResellersService {
  constructor(
    private prisma: PrismaService,
    private creditLedger: CreditLedgerService,
  ) {}

  async findAll(actor: { sub: string; role: string }) {
    const include = {
      user: { select: { email: true, lastLoginAt: true } },
      parent: { include: { user: { select: { username: true } } } },
      _count: { select: { users: true } },
    } as const;

    let resellers;
    if (actor.role === 'ADMIN') {
      resellers = await this.prisma.reseller.findMany({
        include,
        orderBy: { createdAt: 'desc' },
      });
    } else {
      const reseller = await this.prisma.reseller.findUnique({ where: { userId: actor.sub } });
      if (!reseller) throw new ForbiddenException();
      const subtreeIds = await getResellerSubtreeIds(this.prisma, reseller.id);
      resellers = await this.prisma.reseller.findMany({
        where: { id: { in: subtreeIds } },
        include,
        orderBy: { createdAt: 'desc' },
      });
    }

    const balances = await Promise.all(
      resellers.map((r) => this.creditLedger.getBalance(r.id)),
    );

    return resellers.map((r, i) => ({
      ...r,
      creditBalance: balances[i],
    }));
  }

  async findOne(id: string, actor: { sub: string; role: string }) {
    const reseller = await this.prisma.reseller.findUnique({
      where: { id },
      include: { user: { select: { email: true } }, children: true },
    });
    if (!reseller) throw new NotFoundException('Reseller not found');
    await this.assertScope(actor, id);
    return reseller;
  }

  async create(data: { userId: string; companyName: string; parentId?: string; maxDepth?: number }, actor: { sub: string; role: string }) {
    // Verify the user exists and update their role to RESELLER
    const user = await this.prisma.user.findUnique({ where: { id: data.userId } });
    if (!user) throw new NotFoundException('User not found');

    let parentId = data.parentId;

    if (actor.role === 'RESELLER') {
      // Resellers must create sub-resellers within their own subtree
      const actorReseller = await this.prisma.reseller.findUnique({ where: { userId: actor.sub } });
      if (!actorReseller) throw new ForbiddenException('Reseller profile not found');
      if (parentId) {
        const subtreeIds = await getResellerSubtreeIds(this.prisma, actorReseller.id);
        if (!subtreeIds.includes(parentId)) {
          throw new ForbiddenException('Cannot create sub-reseller outside your subtree');
        }
      } else {
        // Default to the actor's own reseller as parent
        parentId = actorReseller.id;
      }
    }

    if (parentId) {
      const parent = await this.prisma.reseller.findUnique({ where: { id: parentId } });
      if (!parent) throw new NotFoundException('Parent reseller not found');
      // Check depth
      const depth = await this.getDepth(parentId);
      if (depth >= parent.maxDepth) throw new BadRequestException('Max reseller depth exceeded');
    }

    const [reseller] = await this.prisma.$transaction([
      this.prisma.reseller.create({
        data: {
          userId: data.userId,
          companyName: data.companyName,
          parentId,
          maxDepth: data.maxDepth ?? 3,
        },
      }),
      this.prisma.user.update({
        where: { id: data.userId },
        data: { role: Role.RESELLER },
      }),
    ]);

    return reseller;
  }

  async update(id: string, data: { companyName?: string; maxDepth?: number }, actor: { sub: string; role: string }) {
    const reseller = await this.prisma.reseller.findUnique({ where: { id } });
    if (!reseller) throw new NotFoundException('Reseller not found');
    await this.assertScope(actor, id);
    return this.prisma.reseller.update({ where: { id }, data });
  }

  async delete(id: string, actor: { sub: string; role: string }) {
    const reseller = await this.prisma.reseller.findUnique({ where: { id } });
    if (!reseller) throw new NotFoundException('Reseller not found');
    await this.assertScope(actor, id);
    await this.prisma.reseller.delete({ where: { id } });
    return { deleted: true };
  }

  async getTree(rootId: string, actor: { sub: string; role: string }) {
    await this.assertScope(actor, rootId);
    const subtreeIds = await getResellerSubtreeIds(this.prisma, rootId);
    return this.prisma.reseller.findMany({
      where: { id: { in: subtreeIds } },
      include: { user: { select: { email: true } } },
    });
  }

  private async assertScope(actor: { sub: string; role: string }, targetResellerId: string) {
    if (actor.role === 'ADMIN') return;
    const reseller = await this.prisma.reseller.findUnique({ where: { userId: actor.sub } });
    if (!reseller) throw new ForbiddenException();
    const subtreeIds = await getResellerSubtreeIds(this.prisma, reseller.id);
    if (!subtreeIds.includes(targetResellerId)) {
      throw new ForbiddenException();
    }
  }

  private async getDepth(resellerId: string): Promise<number> {
    const result = await this.prisma.$queryRaw<{ depth: number }[]>`
      WITH RECURSIVE ancestors AS (
        SELECT id, "parentId", 0 AS depth FROM "Reseller" WHERE id = ${resellerId}
        UNION ALL
        SELECT r.id, r."parentId", a.depth + 1 FROM "Reseller" r INNER JOIN ancestors a ON r.id = a."parentId"
      )
      SELECT MAX(depth) as depth FROM ancestors
    `;
    return result[0]?.depth ?? 0;
  }
}

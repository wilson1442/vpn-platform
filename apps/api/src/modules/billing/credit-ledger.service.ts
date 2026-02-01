import { Injectable, BadRequestException } from '@nestjs/common';
import { LedgerEntryType } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class CreditLedgerService {
  constructor(private prisma: PrismaService) {}

  async getBalance(resellerId: string): Promise<number> {
    const last = await this.prisma.creditLedgerEntry.findFirst({
      where: { resellerId },
      orderBy: { createdAt: 'desc' },
    });
    return last?.balanceAfter ?? 0;
  }

  async addCredits(resellerId: string, amount: number, description: string = 'Credit added') {
    return this.prisma.$transaction(async (tx) => {
      // Lock reseller's latest entry
      const entries = await tx.$queryRaw<{ balanceAfter: number }[]>`
        SELECT "balanceAfter" FROM "CreditLedgerEntry"
        WHERE "resellerId" = ${resellerId}
        ORDER BY "createdAt" DESC
        LIMIT 1
        FOR UPDATE
      `;
      const currentBalance = entries[0]?.balanceAfter ?? 0;
      const newBalance = currentBalance + amount;

      return tx.creditLedgerEntry.create({
        data: {
          resellerId,
          type: LedgerEntryType.ADD,
          amount,
          balanceAfter: newBalance,
          description,
        },
      });
    });
  }

  async deductCredits(resellerId: string, amount: number, description: string = 'Credit deducted') {
    return this.prisma.$transaction(async (tx) => {
      const entries = await tx.$queryRaw<{ balanceAfter: number }[]>`
        SELECT "balanceAfter" FROM "CreditLedgerEntry"
        WHERE "resellerId" = ${resellerId}
        ORDER BY "createdAt" DESC
        LIMIT 1
        FOR UPDATE
      `;
      const currentBalance = entries[0]?.balanceAfter ?? 0;
      if (currentBalance < amount) {
        throw new BadRequestException('Insufficient credits');
      }
      const newBalance = currentBalance - amount;

      return tx.creditLedgerEntry.create({
        data: {
          resellerId,
          type: LedgerEntryType.DEDUCT,
          amount: -amount,
          balanceAfter: newBalance,
          description,
        },
      });
    });
  }

  async getHistory(resellerId: string) {
    return this.prisma.creditLedgerEntry.findMany({
      where: { resellerId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getAllLogs(options: { resellerIds?: string[]; limit?: number; offset?: number } = {}) {
    const { resellerIds, limit = 200, offset = 0 } = options;
    const where = resellerIds ? { resellerId: { in: resellerIds } } : {};
    const [data, total] = await Promise.all([
      this.prisma.creditLedgerEntry.findMany({
        where,
        include: { reseller: { select: { id: true, companyName: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.creditLedgerEntry.count({ where }),
    ]);
    return { data, total };
  }
}

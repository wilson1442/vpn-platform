import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CreditLedgerService } from './credit-ledger.service';
import { PrismaService } from '../../common/prisma.service';

describe('CreditLedgerService', () => {
  let service: CreditLedgerService;
  let prisma: Record<string, any>;

  beforeEach(async () => {
    prisma = {
      creditLedgerEntry: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        CreditLedgerService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(CreditLedgerService);
  });

  describe('getBalance', () => {
    it('should return 0 if no ledger entries exist', async () => {
      prisma.creditLedgerEntry.findFirst.mockResolvedValue(null);
      expect(await service.getBalance('reseller-1')).toBe(0);
    });

    it('should return balanceAfter from latest entry', async () => {
      prisma.creditLedgerEntry.findFirst.mockResolvedValue({ balanceAfter: 500 });
      expect(await service.getBalance('reseller-1')).toBe(500);
    });
  });

  describe('addCredits', () => {
    it('should add credits and return new entry', async () => {
      const newEntry = { id: 'entry-1', amount: 100, balanceAfter: 100, type: 'ADD' };
      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([]),
          creditLedgerEntry: {
            create: jest.fn().mockResolvedValue(newEntry),
          },
        };
        return fn(tx);
      });

      const result = await service.addCredits('reseller-1', 100);
      expect(result).toEqual(newEntry);
    });

    it('should add to existing balance', async () => {
      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([{ balanceAfter: 200 }]),
          creditLedgerEntry: {
            create: jest.fn().mockImplementation((args: any) => Promise.resolve(args.data)),
          },
        };
        return fn(tx);
      });

      const result = await service.addCredits('reseller-1', 50);
      expect(result.balanceAfter).toBe(250);
      expect(result.amount).toBe(50);
    });

    it('should handle zero amount', async () => {
      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([{ balanceAfter: 100 }]),
          creditLedgerEntry: {
            create: jest.fn().mockImplementation((args: any) => Promise.resolve(args.data)),
          },
        };
        return fn(tx);
      });

      const result = await service.addCredits('reseller-1', 0);
      expect(result.balanceAfter).toBe(100);
      expect(result.amount).toBe(0);
    });
  });

  describe('deductCredits', () => {
    it('should throw if insufficient credits', async () => {
      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([{ balanceAfter: 10 }]),
          creditLedgerEntry: { create: jest.fn() },
        };
        return fn(tx);
      });

      await expect(service.deductCredits('reseller-1', 100)).rejects.toThrow(BadRequestException);
    });

    it('should deduct credits from balance', async () => {
      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([{ balanceAfter: 200 }]),
          creditLedgerEntry: {
            create: jest.fn().mockImplementation((args: any) => Promise.resolve(args.data)),
          },
        };
        return fn(tx);
      });

      const result = await service.deductCredits('reseller-1', 50);
      expect(result.balanceAfter).toBe(150);
      expect(result.amount).toBe(-50);
    });

    it('should succeed when deducting exact balance', async () => {
      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([{ balanceAfter: 100 }]),
          creditLedgerEntry: {
            create: jest.fn().mockImplementation((args: any) => Promise.resolve(args.data)),
          },
        };
        return fn(tx);
      });

      const result = await service.deductCredits('reseller-1', 100);
      expect(result.balanceAfter).toBe(0);
      expect(result.amount).toBe(-100);
    });
  });

  describe('getHistory', () => {
    it('should return ledger entries for reseller', async () => {
      const entries = [{ id: '1' }, { id: '2' }];
      prisma.creditLedgerEntry.findMany.mockResolvedValue(entries);
      const result = await service.getHistory('reseller-1');
      expect(result).toEqual(entries);
      expect(prisma.creditLedgerEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { resellerId: 'reseller-1' } }),
      );
    });
  });
});

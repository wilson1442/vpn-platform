import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { InvoiceService } from './invoice.service';
import { PrismaService } from '../../common/prisma.service';
import { CreditLedgerService } from './credit-ledger.service';

describe('InvoiceService', () => {
  let service: InvoiceService;
  let prisma: Record<string, any>;
  let credits: Record<string, any>;

  const mockInvoice = {
    id: 'inv-1',
    resellerId: 'reseller-1',
    amountCents: 5000,
    status: 'PENDING',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      invoice: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    credits = {
      addCredits: jest.fn().mockResolvedValue({}),
    };

    const module = await Test.createTestingModule({
      providers: [
        InvoiceService,
        { provide: PrismaService, useValue: prisma },
        { provide: CreditLedgerService, useValue: credits },
      ],
    }).compile();

    service = module.get(InvoiceService);
  });

  describe('create', () => {
    it('should create an invoice', async () => {
      prisma.invoice.create.mockResolvedValue(mockInvoice);
      const result = await service.create('reseller-1', 5000);
      expect(result).toEqual(mockInvoice);
      expect(prisma.invoice.create).toHaveBeenCalledWith({
        data: { resellerId: 'reseller-1', amountCents: 5000 },
      });
    });
  });

  describe('markPaid', () => {
    it('should mark invoice as paid and add credits', async () => {
      prisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      prisma.invoice.update.mockResolvedValue({ ...mockInvoice, status: 'PAID' });

      const result = await service.markPaid('inv-1');
      expect(result).toEqual({ paid: true });
      expect(prisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { status: 'PAID' },
      });
      expect(credits.addCredits).toHaveBeenCalledWith('reseller-1', 5000, 'Invoice inv-1 paid');
    });

    it('should throw NotFoundException if invoice not found', async () => {
      prisma.invoice.findUnique.mockResolvedValue(null);
      await expect(service.markPaid('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByReseller', () => {
    it('should return invoices for a reseller', async () => {
      prisma.invoice.findMany.mockResolvedValue([mockInvoice]);
      const result = await service.findByReseller('reseller-1');
      expect(result).toEqual([mockInvoice]);
      expect(prisma.invoice.findMany).toHaveBeenCalledWith({
        where: { resellerId: 'reseller-1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findAll', () => {
    it('should return all invoices with reseller info', async () => {
      prisma.invoice.findMany.mockResolvedValue([mockInvoice]);
      const result = await service.findAll();
      expect(result).toEqual([mockInvoice]);
      expect(prisma.invoice.findMany).toHaveBeenCalledWith({
        include: { reseller: { include: { user: { select: { email: true } } } } },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});

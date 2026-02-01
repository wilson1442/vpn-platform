import { Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { CreditLedgerService } from './credit-ledger.service';

@Injectable()
export class InvoiceService {
  constructor(
    private prisma: PrismaService,
    private credits: CreditLedgerService,
  ) {}

  async create(resellerId: string, amountCents: number) {
    return this.prisma.invoice.create({
      data: { resellerId, amountCents },
    });
  }

  async markPaid(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: InvoiceStatus.PAID },
    });

    // Add credits to the reseller
    await this.credits.addCredits(
      invoice.resellerId,
      invoice.amountCents,
      `Invoice ${invoiceId} paid`,
    );

    return { paid: true };
  }

  async findByReseller(resellerId: string) {
    return this.prisma.invoice.findMany({
      where: { resellerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll() {
    return this.prisma.invoice.findMany({
      include: { reseller: { include: { user: { select: { email: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async delete(id: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    await this.prisma.invoice.delete({ where: { id } });
    return { deleted: true };
  }
}

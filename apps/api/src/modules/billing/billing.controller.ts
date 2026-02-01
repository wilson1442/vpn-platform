import { Controller, Get, Post, Patch, Delete, Param, Body, Query, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles, CurrentUser } from '../../common/decorators';
import { EntitlementService } from './entitlement.service';
import { CreditLedgerService } from './credit-ledger.service';
import { InvoiceService } from './invoice.service';
import { PrismaService } from '../../common/prisma.service';
import { getResellerSubtreeIds } from '../../common/reseller-scope.util';

@Controller()
export class BillingController {
  constructor(
    private entitlements: EntitlementService,
    private credits: CreditLedgerService,
    private invoices: InvoiceService,
    private prisma: PrismaService,
  ) {}

  // Packages
  @Get('packages')
  @Roles(Role.ADMIN, Role.RESELLER)
  async findPackages(@CurrentUser() actor: any) {
    if (actor.role === 'ADMIN') {
      return this.prisma.package.findMany({ where: { isActive: true }, orderBy: { createdAt: 'desc' } });
    }
    const reseller = await this.prisma.reseller.findUnique({ where: { userId: actor.sub } });
    if (!reseller) throw new ForbiddenException();
    const subtreeIds = await getResellerSubtreeIds(this.prisma, reseller.id);
    return this.prisma.package.findMany({
      where: { isActive: true, OR: [{ resellerId: null }, { resellerId: { in: subtreeIds } }] },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('packages')
  @Roles(Role.ADMIN, Role.RESELLER)
  async createPackage(@Body() body: { name: string; duration: string; description?: string; maxConnections: number; maxDevices: number; priceMonthly: number; creditCost?: number; resellerId?: string }, @CurrentUser() actor: any) {
    if (actor.role === 'RESELLER') {
      const reseller = await this.prisma.reseller.findUnique({ where: { userId: actor.sub } });
      if (!reseller) throw new ForbiddenException();
      return this.prisma.package.create({ data: { ...body, resellerId: reseller.id, creditCost: body.creditCost ?? 0 } });
    }
    return this.prisma.package.create({ data: { ...body, creditCost: body.creditCost ?? 0 } });
  }

  @Patch('packages/:id')
  @Roles(Role.ADMIN, Role.RESELLER)
  async updatePackage(@Param('id') id: string, @Body() body: { name?: string; duration?: string; description?: string; maxConnections?: number; maxDevices?: number; priceMonthly?: number; creditCost?: number }, @CurrentUser() actor: any) {
    const pkg = await this.prisma.package.findUnique({ where: { id } });
    if (!pkg) throw new NotFoundException('Package not found');
    if (actor.role === 'RESELLER') {
      const reseller = await this.prisma.reseller.findUnique({ where: { userId: actor.sub } });
      if (!reseller || pkg.resellerId !== reseller.id) throw new ForbiddenException();
    }
    return this.prisma.package.update({ where: { id }, data: body });
  }

  @Delete('packages/:id')
  @Roles(Role.ADMIN, Role.RESELLER)
  async deletePackage(@Param('id') id: string, @CurrentUser() actor: any) {
    const pkg = await this.prisma.package.findUnique({ where: { id } });
    if (!pkg) throw new NotFoundException('Package not found');
    if (actor.role === 'RESELLER') {
      const reseller = await this.prisma.reseller.findUnique({ where: { userId: actor.sub } });
      if (!reseller || pkg.resellerId !== reseller.id) throw new ForbiddenException();
    }
    await this.prisma.package.delete({ where: { id } });
    return { deleted: true };
  }

  // Entitlements
  @Post('entitlements')
  @Roles(Role.ADMIN, Role.RESELLER)
  async createEntitlement(@Body() body: { userId: string; packageId: string }, @CurrentUser() actor: any) {
    await this.assertUserScope(actor, body.userId);
    await this.assertPackageScope(actor, body.packageId);
    await this.deductCreditsIfReseller(actor, body.packageId);
    return this.entitlements.create(body.userId, body.packageId);
  }

  @Post('entitlements/:id/deactivate')
  @Roles(Role.ADMIN, Role.RESELLER)
  async deactivateEntitlement(@Param('id') id: string, @CurrentUser() actor: any) {
    await this.assertEntitlementScope(actor, id);
    return this.entitlements.deactivate(id);
  }

  @Post('entitlements/:id/activate')
  @Roles(Role.ADMIN, Role.RESELLER)
  async activateEntitlement(@Param('id') id: string, @CurrentUser() actor: any) {
    await this.assertEntitlementScope(actor, id);
    return this.entitlements.activate(id);
  }

  @Get('entitlements/user/:userId')
  async findEntitlementByUser(@Param('userId') userId: string, @CurrentUser() actor: any) {
    await this.assertUserScope(actor, userId);
    return this.entitlements.findByUser(userId);
  }

  // Credits
  @Get('credits/:resellerId')
  @Roles(Role.ADMIN, Role.RESELLER)
  async getBalance(@Param('resellerId') resellerId: string, @CurrentUser() actor: any) {
    await this.assertResellerScope(actor, resellerId);
    return this.credits.getBalance(resellerId).then((balance) => ({ balance }));
  }

  @Get('credits/:resellerId/history')
  @Roles(Role.ADMIN, Role.RESELLER)
  async getHistory(@Param('resellerId') resellerId: string, @CurrentUser() actor: any) {
    await this.assertResellerScope(actor, resellerId);
    return this.credits.getHistory(resellerId);
  }

  @Post('credits/add')
  @Roles(Role.ADMIN, Role.RESELLER)
  async addCredits(@Body() body: { resellerId: string; amount: number; description?: string }, @CurrentUser() actor: any) {
    if (actor.role === 'RESELLER') {
      await this.assertResellerScope(actor, body.resellerId);
    }
    return this.credits.addCredits(body.resellerId, body.amount, body.description || 'Credit added');
  }

  @Post('credits/deduct')
  @Roles(Role.ADMIN, Role.RESELLER)
  async deductCreditsManual(@Body() body: { resellerId: string; amount: number; description?: string }, @CurrentUser() actor: any) {
    if (actor.role === 'RESELLER') {
      await this.assertResellerScope(actor, body.resellerId);
    }
    return this.credits.deductCredits(body.resellerId, body.amount, body.description || 'Credit deducted');
  }

  @Get('credits/logs')
  @Roles(Role.ADMIN, Role.RESELLER)
  async getCreditLogs(
    @CurrentUser() actor: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    let resellerIds: string[] | undefined;
    if (actor.role === 'RESELLER') {
      const reseller = await this.prisma.reseller.findUnique({ where: { userId: actor.sub } });
      if (!reseller) throw new ForbiddenException();
      resellerIds = await getResellerSubtreeIds(this.prisma, reseller.id);
    }
    return this.credits.getAllLogs({
      resellerIds,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  // Invoices
  @Get('invoices')
  @Roles(Role.ADMIN)
  findAllInvoices() {
    return this.invoices.findAll();
  }

  @Get('invoices/reseller/:resellerId')
  @Roles(Role.ADMIN, Role.RESELLER)
  async findInvoicesByReseller(@Param('resellerId') resellerId: string, @CurrentUser() actor: any) {
    await this.assertResellerScope(actor, resellerId);
    return this.invoices.findByReseller(resellerId);
  }

  @Post('invoices')
  @Roles(Role.ADMIN)
  createInvoice(@Body() body: { resellerId: string; amountCents: number }) {
    return this.invoices.create(body.resellerId, body.amountCents);
  }

  @Post('invoices/:id/pay')
  @Roles(Role.ADMIN)
  markPaid(@Param('id') id: string) {
    return this.invoices.markPaid(id);
  }

  @Delete('invoices/:id')
  @Roles(Role.ADMIN)
  deleteInvoice(@Param('id') id: string) {
    return this.invoices.delete(id);
  }

  private async deductCreditsIfReseller(actor: any, packageId: string) {
    if (actor.role !== 'RESELLER') return;
    const pkg = await this.prisma.package.findUnique({ where: { id: packageId } });
    if (!pkg || pkg.creditCost <= 0) return;
    const reseller = await this.prisma.reseller.findUnique({ where: { userId: actor.sub } });
    if (!reseller) throw new ForbiddenException();
    await this.credits.deductCredits(reseller.id, pkg.creditCost, `Package: ${pkg.name} assigned to user`);
  }

  private async assertResellerScope(actor: any, targetResellerId: string) {
    if (actor.role === 'ADMIN') return;
    const reseller = await this.prisma.reseller.findUnique({ where: { userId: actor.sub } });
    if (!reseller) throw new ForbiddenException();
    const subtreeIds = await getResellerSubtreeIds(this.prisma, reseller.id);
    if (!subtreeIds.includes(targetResellerId)) throw new ForbiddenException();
  }

  private async assertUserScope(actor: any, userId: string) {
    if (actor.role === 'ADMIN') return;
    if (actor.role === 'USER' && actor.sub === userId) return;
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { resellerId: true } });
    if (!user?.resellerId) throw new ForbiddenException();
    await this.assertResellerScope(actor, user.resellerId);
  }

  private async assertEntitlementScope(actor: any, entitlementId: string) {
    if (actor.role === 'ADMIN') return;
    const user = await this.prisma.user.findFirst({
      where: { entitlementId },
      select: { resellerId: true },
    });
    if (!user?.resellerId) throw new ForbiddenException();
    await this.assertResellerScope(actor, user.resellerId);
  }

  private async assertPackageScope(actor: any, packageId: string) {
    if (actor.role === 'ADMIN') return;
    const pkg = await this.prisma.package.findUnique({ where: { id: packageId } });
    if (!pkg) throw new NotFoundException('Package not found');
    if (pkg.resellerId === null) return; // global package, accessible to all
    const reseller = await this.prisma.reseller.findUnique({ where: { userId: actor.sub } });
    if (!reseller) throw new ForbiddenException();
    const subtreeIds = await getResellerSubtreeIds(this.prisma, reseller.id);
    if (!subtreeIds.includes(pkg.resellerId)) throw new ForbiddenException();
  }
}

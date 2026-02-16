import { Controller, Get, Post, Patch, Delete, Param, Body, Query, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles, CurrentUser } from '../../common/decorators';
import { RequireFeature } from '../license/license.constants';
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

  // Credit Packages
  @Get('credit-packages')
  @Roles(Role.ADMIN, Role.RESELLER)
  @RequireFeature('resellers')
  findCreditPackages() {
    return this.prisma.creditPackage.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('credit-packages')
  @Roles(Role.ADMIN)
  @RequireFeature('resellers')
  createCreditPackage(@Body() body: { name: string; credits: number; price: number; description?: string }) {
    return this.prisma.creditPackage.create({
      data: {
        name: body.name,
        credits: body.credits,
        price: body.price,
        description: body.description || '',
      },
    });
  }

  @Patch('credit-packages/:id')
  @Roles(Role.ADMIN)
  @RequireFeature('resellers')
  async updateCreditPackage(@Param('id') id: string, @Body() body: { name?: string; credits?: number; price?: number; description?: string; isActive?: boolean }) {
    const pkg = await this.prisma.creditPackage.findUnique({ where: { id } });
    if (!pkg) throw new NotFoundException('Credit package not found');
    return this.prisma.creditPackage.update({ where: { id }, data: body });
  }

  @Delete('credit-packages/:id')
  @Roles(Role.ADMIN)
  @RequireFeature('resellers')
  async deleteCreditPackage(@Param('id') id: string) {
    const pkg = await this.prisma.creditPackage.findUnique({ where: { id } });
    if (!pkg) throw new NotFoundException('Credit package not found');
    await this.prisma.creditPackage.delete({ where: { id } });
    return { deleted: true };
  }

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
  @Post('credits/add')
  @Roles(Role.ADMIN)
  @RequireFeature('resellers')
  async addCredits(@Body() body: { resellerId: string; amount: number; description?: string }) {
    return this.credits.addCredits(body.resellerId, body.amount, body.description || 'Credit added by admin');
  }

  @Post('credits/deduct')
  @Roles(Role.ADMIN)
  @RequireFeature('resellers')
  async deductCredits(@Body() body: { resellerId: string; amount: number; description?: string }) {
    return this.credits.deductCredits(body.resellerId, body.amount, body.description || 'Credit deducted by admin');
  }

  @Get('credits/logs')
  @Roles(Role.ADMIN, Role.RESELLER)
  @RequireFeature('resellers')
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

  // Payment Gateways
  @Get('payment-gateways')
  @Roles(Role.ADMIN)
  findPaymentGateways() {
    return this.prisma.paymentGateway.findMany({ orderBy: { provider: 'asc' } });
  }

  @Post('payment-gateways')
  @Roles(Role.ADMIN)
  createPaymentGateway(@Body() body: { provider: string; displayName: string; isEnabled?: boolean; config?: any }) {
    return this.prisma.paymentGateway.create({
      data: {
        provider: body.provider,
        displayName: body.displayName,
        isEnabled: body.isEnabled ?? false,
        config: body.config ?? {},
      },
    });
  }

  @Patch('payment-gateways/:id')
  @Roles(Role.ADMIN)
  async updatePaymentGateway(@Param('id') id: string, @Body() body: { displayName?: string; isEnabled?: boolean; config?: any }) {
    const gw = await this.prisma.paymentGateway.findUnique({ where: { id } });
    if (!gw) throw new NotFoundException('Payment gateway not found');
    return this.prisma.paymentGateway.update({ where: { id }, data: body });
  }

  @Delete('payment-gateways/:id')
  @Roles(Role.ADMIN)
  async deletePaymentGateway(@Param('id') id: string) {
    const gw = await this.prisma.paymentGateway.findUnique({ where: { id } });
    if (!gw) throw new NotFoundException('Payment gateway not found');
    await this.prisma.paymentGateway.delete({ where: { id } });
    return { deleted: true };
  }

  @Post('payment-gateways/seed-defaults')
  @Roles(Role.ADMIN)
  async seedDefaultGateways() {
    const defaults = [
      { provider: 'stripe', displayName: 'Stripe' },
      { provider: 'paypal', displayName: 'PayPal' },
      { provider: 'authorize_net', displayName: 'Authorize.net' },
      { provider: 'venmo', displayName: 'Venmo' },
      { provider: 'cashapp', displayName: 'Cash App' },
      { provider: 'zelle', displayName: 'Zelle' },
    ];
    for (const gw of defaults) {
      await this.prisma.paymentGateway.upsert({
        where: { provider: gw.provider },
        update: {},
        create: { ...gw, isEnabled: false, config: {} },
      });
    }
    return this.prisma.paymentGateway.findMany({ orderBy: { provider: 'asc' } });
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

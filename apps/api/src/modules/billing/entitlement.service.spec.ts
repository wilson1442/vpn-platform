import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EntitlementService } from './entitlement.service';
import { PrismaService } from '../../common/prisma.service';

describe('EntitlementService', () => {
  let service: EntitlementService;
  let prisma: Record<string, any>;

  const mockPlan = { id: 'plan-1', name: 'Basic', maxConnections: 2, maxDevices: 5 };
  const mockUser = { id: 'user-1', email: 'u@test.com', entitlementId: null };
  const mockEntitlement = { id: 'ent-1', planId: 'plan-1', maxConnections: 2, maxDevices: 5, isActive: true };

  beforeEach(async () => {
    prisma = {
      plan: { findUnique: jest.fn() },
      user: { findUnique: jest.fn(), update: jest.fn() },
      entitlement: { create: jest.fn(), update: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        EntitlementService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(EntitlementService);
  });

  describe('create', () => {
    it('should create an entitlement and link to user', async () => {
      prisma.plan.findUnique.mockResolvedValue(mockPlan);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.entitlement.create.mockResolvedValue(mockEntitlement);
      prisma.user.update.mockResolvedValue({});

      const result = await service.create('user-1', 'plan-1');
      expect(result).toEqual(mockEntitlement);
      expect(prisma.entitlement.create).toHaveBeenCalledWith({
        data: {
          planId: 'plan-1',
          maxConnections: 2,
          maxDevices: 5,
          isActive: true,
        },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { entitlementId: mockEntitlement.id },
      });
    });

    it('should throw NotFoundException if plan not found', async () => {
      prisma.plan.findUnique.mockResolvedValue(null);
      await expect(service.create('user-1', 'bad-plan')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.plan.findUnique.mockResolvedValue(mockPlan);
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.create('bad-user', 'plan-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if user already has entitlement', async () => {
      prisma.plan.findUnique.mockResolvedValue(mockPlan);
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, entitlementId: 'existing-ent' });
      await expect(service.create('user-1', 'plan-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('deactivate', () => {
    it('should set isActive to false', async () => {
      prisma.entitlement.update.mockResolvedValue({ ...mockEntitlement, isActive: false });
      const result = await service.deactivate('ent-1');
      expect(result.isActive).toBe(false);
      expect(prisma.entitlement.update).toHaveBeenCalledWith({
        where: { id: 'ent-1' },
        data: { isActive: false },
      });
    });
  });

  describe('activate', () => {
    it('should set isActive to true', async () => {
      prisma.entitlement.update.mockResolvedValue({ ...mockEntitlement, isActive: true });
      const result = await service.activate('ent-1');
      expect(result.isActive).toBe(true);
      expect(prisma.entitlement.update).toHaveBeenCalledWith({
        where: { id: 'ent-1' },
        data: { isActive: true },
      });
    });
  });

  describe('findByUser', () => {
    it('should return entitlement with plan', async () => {
      const userWithEntitlement = {
        ...mockUser,
        entitlement: { ...mockEntitlement, plan: mockPlan },
      };
      prisma.user.findUnique.mockResolvedValue(userWithEntitlement);
      const result = await service.findByUser('user-1');
      expect(result).toEqual(userWithEntitlement.entitlement);
    });

    it('should return null if user has no entitlement', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, entitlement: null });
      const result = await service.findByUser('user-1');
      expect(result).toBeNull();
    });

    it('should return null if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const result = await service.findByUser('bad-user');
      expect(result).toBeNull();
    });
  });
});

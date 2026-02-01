import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../../common/prisma.service';
import { EntitlementService } from '../billing/entitlement.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: Record<string, any>;

  const adminActor = { sub: 'admin-1', role: 'ADMIN' };
  const resellerActor = { sub: 'reseller-user-1', role: 'RESELLER' };
  const userActor = { sub: 'user-1', role: 'USER' };

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      reseller: {
        findUnique: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: EntitlementService, useValue: { create: jest.fn(), extend: jest.fn() } },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  describe('findAll - reseller scoping', () => {
    it('should return all users for admin', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      await service.findAll(adminActor);
      expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    });

    it('should scope to reseller subtree', async () => {
      prisma.reseller.findUnique.mockResolvedValue({ id: 'reseller-1' });
      prisma.$queryRaw.mockResolvedValue([{ id: 'reseller-1' }, { id: 'child-reseller' }]);
      prisma.user.findMany.mockResolvedValue([]);

      await service.findAll(resellerActor);
      expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { resellerId: { in: ['reseller-1', 'child-reseller'] } },
      }));
    });

    it('should scope to own user only for USER role', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      await service.findAll(userActor);
      expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'user-1' },
      }));
    });

    it('should throw ForbiddenException if reseller profile not found', async () => {
      prisma.reseller.findUnique.mockResolvedValue(null);
      await expect(service.findAll(resellerActor)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findOne - scoping', () => {
    const targetUser = { id: 'user-2', email: 'u@test.com', role: 'USER', resellerId: 'reseller-1', isActive: true, createdAt: new Date(), entitlementId: null };

    it('should allow admin to view any user', async () => {
      prisma.user.findUnique.mockResolvedValue(targetUser);
      const result = await service.findOne('user-2', adminActor);
      expect(result).toEqual(targetUser);
    });

    it('should throw NotFoundException for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.findOne('bad-id', adminActor)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for USER accessing another user', async () => {
      prisma.user.findUnique.mockResolvedValue(targetUser);
      await expect(service.findOne('user-2', userActor)).rejects.toThrow(ForbiddenException);
    });

    it('should allow reseller to view own subtree user', async () => {
      prisma.user.findUnique.mockResolvedValue(targetUser);
      prisma.reseller.findUnique.mockResolvedValue({ id: 'reseller-1' });
      prisma.$queryRaw.mockResolvedValue([{ id: 'reseller-1' }]);

      const result = await service.findOne('user-2', resellerActor);
      expect(result).toEqual(targetUser);
    });

    it('should throw ForbiddenException for reseller accessing out-of-scope user', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...targetUser, resellerId: 'other-reseller' });
      prisma.reseller.findUnique.mockResolvedValue({ id: 'reseller-1' });
      prisma.$queryRaw.mockResolvedValue([{ id: 'reseller-1' }]);

      await expect(service.findOne('user-2', resellerActor)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('create', () => {
    it('should prevent resellers from creating admins', async () => {
      await expect(
        service.create({ username: 'auser', email: 'a@test.com', password: 'pass', role: 'ADMIN' as any }, resellerActor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create a user successfully', async () => {
      const created = { id: 'new-1', email: 'new@test.com', role: 'USER', resellerId: null, isActive: true, createdAt: new Date() };
      prisma.user.create.mockResolvedValue(created);

      const result = await service.create({ username: 'newuser', email: 'new@test.com', password: 'pass', role: 'USER' as any }, adminActor);
      expect(result).toEqual(created);
    });

    it('should assign resellerId when reseller creates USER', async () => {
      prisma.reseller.findUnique.mockResolvedValue({ id: 'reseller-1' });
      const created = { id: 'new-1', email: 'new@test.com', role: 'USER', resellerId: 'reseller-1', isActive: true, createdAt: new Date() };
      prisma.user.create.mockResolvedValue(created);

      await service.create({ username: 'newuser', email: 'new@test.com', password: 'pass', role: 'USER' as any }, resellerActor);
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ resellerId: 'reseller-1' }),
        }),
      );
    });
  });

  describe('update', () => {
    const targetUser = { id: 'user-2', email: 'u@test.com', role: 'USER', resellerId: 'reseller-1', isActive: true };

    it('should allow reseller to update own-subtree user', async () => {
      prisma.user.findUnique.mockResolvedValue(targetUser);
      prisma.reseller.findUnique.mockResolvedValue({ id: 'reseller-1' });
      prisma.$queryRaw.mockResolvedValue([{ id: 'reseller-1' }]);
      prisma.user.update.mockResolvedValue({ ...targetUser, email: 'updated@test.com' });

      const result = await service.update('user-2', { email: 'updated@test.com' }, resellerActor);
      expect(result.email).toBe('updated@test.com');
    });

    it('should throw ForbiddenException for out-of-scope user', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...targetUser, resellerId: 'other-reseller' });
      prisma.reseller.findUnique.mockResolvedValue({ id: 'reseller-1' });
      prisma.$queryRaw.mockResolvedValue([{ id: 'reseller-1' }]);

      await expect(service.update('user-2', { email: 'x@test.com' }, resellerActor)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.update('bad-id', { email: 'x@test.com' }, adminActor)).rejects.toThrow(NotFoundException);
    });
  });
});

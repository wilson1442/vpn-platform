import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ResellersService } from './resellers.service';
import { PrismaService } from '../../common/prisma.service';

// Mock the reseller-scope utility
jest.mock('../../common/reseller-scope.util', () => ({
  getResellerSubtreeIds: jest.fn(),
}));

import { getResellerSubtreeIds } from '../../common/reseller-scope.util';
const mockGetSubtreeIds = getResellerSubtreeIds as jest.MockedFunction<typeof getResellerSubtreeIds>;

describe('ResellersService', () => {
  let service: ResellersService;
  let prisma: Record<string, any>;

  const adminActor = { sub: 'admin-1', role: 'ADMIN' };
  const resellerActor = { sub: 'reseller-user-1', role: 'RESELLER' };

  const mockReseller = {
    id: 'reseller-1',
    userId: 'reseller-user-1',
    companyName: 'Acme VPN',
    parentId: null,
    maxDepth: 3,
    createdAt: new Date(),
    user: { email: 'reseller@test.com' },
    children: [],
  };

  beforeEach(async () => {
    prisma = {
      reseller: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $queryRaw: jest.fn(),
      $transaction: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        ResellersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ResellersService);
    mockGetSubtreeIds.mockReset();
  });

  describe('findAll', () => {
    it('should return all resellers for admin', async () => {
      prisma.reseller.findMany.mockResolvedValue([mockReseller]);
      const result = await service.findAll(adminActor);
      expect(result).toEqual([mockReseller]);
    });

    it('should scope to subtree for reseller', async () => {
      prisma.reseller.findUnique.mockResolvedValue(mockReseller);
      mockGetSubtreeIds.mockResolvedValue(['reseller-1', 'child-reseller']);
      prisma.reseller.findMany.mockResolvedValue([mockReseller]);

      await service.findAll(resellerActor);
      expect(prisma.reseller.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['reseller-1', 'child-reseller'] } },
        }),
      );
    });

    it('should throw ForbiddenException if reseller profile not found', async () => {
      prisma.reseller.findUnique.mockResolvedValue(null);
      await expect(service.findAll(resellerActor)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findOne', () => {
    it('should return reseller for admin', async () => {
      prisma.reseller.findUnique.mockResolvedValue(mockReseller);
      const result = await service.findOne('reseller-1', adminActor);
      expect(result).toEqual(mockReseller);
    });

    it('should throw NotFoundException if reseller not found', async () => {
      prisma.reseller.findUnique.mockResolvedValue(null);
      await expect(service.findOne('bad-id', adminActor)).rejects.toThrow(NotFoundException);
    });

    it('should assert scope for reseller actor', async () => {
      // First call: findOne lookup; second call: assertScope lookup
      prisma.reseller.findUnique
        .mockResolvedValueOnce(mockReseller) // findOne
        .mockResolvedValueOnce(mockReseller); // assertScope
      mockGetSubtreeIds.mockResolvedValue(['reseller-1']);

      const result = await service.findOne('reseller-1', resellerActor);
      expect(result).toEqual(mockReseller);
    });

    it('should throw ForbiddenException for out-of-scope reseller', async () => {
      prisma.reseller.findUnique
        .mockResolvedValueOnce(mockReseller) // findOne
        .mockResolvedValueOnce({ id: 'other-reseller', userId: 'reseller-user-1' }); // assertScope
      mockGetSubtreeIds.mockResolvedValue(['other-reseller']);

      await expect(service.findOne('reseller-1', resellerActor)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('create', () => {
    it('should create reseller as admin', async () => {
      const user = { id: 'new-user', email: 'new@test.com' };
      prisma.user.findUnique.mockResolvedValue(user);
      const created = { id: 'new-reseller', userId: 'new-user', companyName: 'New Co' };
      prisma.$transaction.mockResolvedValue([created, {}]);

      const result = await service.create(
        { userId: 'new-user', companyName: 'New Co' },
        adminActor,
      );
      expect(result).toEqual(created);
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.create({ userId: 'bad-user', companyName: 'X' }, adminActor),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create sub-reseller with reseller actor defaulting to own id as parent', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'new-user' });
      prisma.reseller.findUnique
        .mockResolvedValueOnce({ id: 'reseller-1', userId: 'reseller-user-1', maxDepth: 3 }) // actor reseller
        .mockResolvedValueOnce({ id: 'reseller-1', maxDepth: 3 }); // parent lookup
      prisma.$queryRaw.mockResolvedValue([{ depth: 1 }]);
      prisma.$transaction.mockResolvedValue([{ id: 'sub-reseller' }, {}]);

      const result = await service.create(
        { userId: 'new-user', companyName: 'Sub Co' },
        resellerActor,
      );
      expect(result).toEqual({ id: 'sub-reseller' });
    });

    it('should throw BadRequestException if max depth exceeded', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'new-user' });
      prisma.reseller.findUnique
        .mockResolvedValueOnce({ id: 'reseller-1', userId: 'reseller-user-1', maxDepth: 3 })
        .mockResolvedValueOnce({ id: 'reseller-1', maxDepth: 3 });
      prisma.$queryRaw.mockResolvedValue([{ depth: 3 }]);

      await expect(
        service.create({ userId: 'new-user', companyName: 'Too Deep' }, resellerActor),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if parent reseller not found', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'new-user' });
      prisma.reseller.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ userId: 'new-user', companyName: 'X', parentId: 'bad-parent' }, adminActor),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if reseller creates outside subtree', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'new-user' });
      prisma.reseller.findUnique.mockResolvedValue({ id: 'reseller-1', userId: 'reseller-user-1', maxDepth: 3 });
      mockGetSubtreeIds.mockResolvedValue(['reseller-1']);

      await expect(
        service.create({ userId: 'new-user', companyName: 'X', parentId: 'outside-id' }, resellerActor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getTree', () => {
    it('should return subtree for admin', async () => {
      mockGetSubtreeIds.mockResolvedValue(['reseller-1', 'child-1']);
      prisma.reseller.findMany.mockResolvedValue([mockReseller]);

      const result = await service.getTree('reseller-1', adminActor);
      expect(result).toEqual([mockReseller]);
    });

    it('should assert scope for reseller actor', async () => {
      prisma.reseller.findUnique.mockResolvedValue(mockReseller);
      mockGetSubtreeIds
        .mockResolvedValueOnce(['reseller-1']) // assertScope
        .mockResolvedValueOnce(['reseller-1']); // getTree
      prisma.reseller.findMany.mockResolvedValue([mockReseller]);

      const result = await service.getTree('reseller-1', resellerActor);
      expect(result).toEqual([mockReseller]);
    });
  });
});

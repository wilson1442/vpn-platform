import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SessionsService } from './sessions.service';
import { PrismaService } from '../../common/prisma.service';

// Mock global fetch
global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;

describe('SessionsService', () => {
  let service: SessionsService;
  let prisma: Record<string, any>;

  const mockCert = {
    id: 'cert-1',
    userId: 'user-1',
    commonName: 'client-1',
    revokedAt: null,
    user: {
      isActive: true,
      resellerId: 'reseller-1',
      entitlement: {
        isActive: true,
        maxConnections: 2,
        plan: { id: 'plan-1' },
      },
    },
  };

  beforeEach(async () => {
    prisma = {
      certificate: { findUnique: jest.fn() },
      vpnSession: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      vpnNode: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      reseller: { findUnique: jest.fn() },
      $transaction: jest.fn(),
      $queryRaw: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(SessionsService);
  });

  describe('connect', () => {
    it('should reject revoked certificate', async () => {
      prisma.certificate.findUnique.mockResolvedValue({ ...mockCert, revokedAt: new Date() });
      await expect(service.connect({ commonName: 'client-1', realAddress: '1.2.3.4', vpnNodeId: 'node-1' }))
        .rejects.toThrow(ForbiddenException);
    });

    it('should reject inactive user', async () => {
      prisma.certificate.findUnique.mockResolvedValue({
        ...mockCert,
        user: { ...mockCert.user, isActive: false },
      });
      await expect(service.connect({ commonName: 'client-1', realAddress: '1.2.3.4', vpnNodeId: 'node-1' }))
        .rejects.toThrow(ForbiddenException);
    });

    it('should reject user without active entitlement', async () => {
      prisma.certificate.findUnique.mockResolvedValue({
        ...mockCert,
        user: { ...mockCert.user, entitlement: null },
      });
      await expect(service.connect({ commonName: 'client-1', realAddress: '1.2.3.4', vpnNodeId: 'node-1' }))
        .rejects.toThrow(ForbiddenException);
    });

    it('should create session when under connection limit', async () => {
      prisma.certificate.findUnique.mockResolvedValue(mockCert);
      const createdSession = { id: 'sess-1', userId: 'user-1', vpnNodeId: 'node-1' };
      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          $queryRaw: jest.fn(),
          vpnSession: {
            findMany: jest.fn().mockResolvedValue([]),
            create: jest.fn().mockResolvedValue(createdSession),
          },
        };
        return fn(tx);
      });

      const result = await service.connect({ commonName: 'client-1', realAddress: '1.2.3.4', vpnNodeId: 'node-1' });
      expect(result).toEqual(createdSession);
    });

    it('should kick oldest session when at connection limit', async () => {
      prisma.certificate.findUnique.mockResolvedValue(mockCert);
      prisma.vpnNode.findUnique.mockResolvedValue({ id: 'node-1', hostname: 'localhost', agentPort: 8080, agentToken: 'tok' });

      const oldSession = { id: 'sess-old', vpnNodeId: 'node-1', commonName: 'client-old' };
      const newSession = { id: 'sess-new', userId: 'user-1', vpnNodeId: 'node-1' };

      prisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          $queryRaw: jest.fn(),
          vpnSession: {
            findMany: jest.fn().mockResolvedValue([oldSession, { id: 'sess-2', vpnNodeId: 'node-1', commonName: 'client-2' }]),
            create: jest.fn().mockResolvedValue(newSession),
          },
        };
        return fn(tx);
      });

      // The kickSession method will be called internally
      prisma.vpnSession.update = jest.fn().mockResolvedValue({});

      const result = await service.connect({ commonName: 'client-1', realAddress: '1.2.3.4', vpnNodeId: 'node-1' });
      expect(result).toEqual(newSession);
    });
  });

  describe('disconnect', () => {
    it('should return ok if session not found', async () => {
      prisma.vpnSession.findFirst.mockResolvedValue(null);
      const result = await service.disconnect({ commonName: 'client-1', vpnNodeId: 'node-1' });
      expect(result).toEqual({ ok: true });
    });

    it('should update session with disconnect timestamp', async () => {
      prisma.vpnSession.findFirst.mockResolvedValue({ id: 'sess-1' });
      prisma.vpnSession.update.mockResolvedValue({ id: 'sess-1', disconnectedAt: new Date() });
      const result = await service.disconnect({ commonName: 'client-1', vpnNodeId: 'node-1', bytesReceived: 100, bytesSent: 50 });
      expect(prisma.vpnSession.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'sess-1' },
      }));
    });
  });

  describe('manualKick', () => {
    it('should throw if session not found', async () => {
      prisma.vpnSession.findUnique.mockResolvedValue(null);
      await expect(service.manualKick('bad-id', { sub: 'admin-1', role: 'ADMIN' }))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw if session already disconnected', async () => {
      prisma.vpnSession.findUnique.mockResolvedValue({
        id: 'sess-1',
        disconnectedAt: new Date(),
        user: { resellerId: 'r1' },
      });
      await expect(service.manualKick('sess-1', { sub: 'admin-1', role: 'ADMIN' }))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAll - reseller scoping', () => {
    it('should return all sessions for admin', async () => {
      prisma.vpnSession.findMany.mockResolvedValue([]);
      await service.findAll({ active: true }, { sub: 'admin-1', role: 'ADMIN' });
      expect(prisma.vpnSession.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { disconnectedAt: null },
      }));
    });

    it('should scope sessions to reseller subtree', async () => {
      prisma.reseller.findUnique.mockResolvedValue({ id: 'reseller-1' });
      prisma.$queryRaw.mockResolvedValue([{ id: 'reseller-1' }, { id: 'reseller-2' }]);
      prisma.vpnSession.findMany.mockResolvedValue([]);

      await service.findAll({}, { sub: 'reseller-user-1', role: 'RESELLER' });
      expect(prisma.vpnSession.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          user: { resellerId: { in: ['reseller-1', 'reseller-2'] } },
        }),
      }));
    });

    it('should throw if reseller profile not found', async () => {
      prisma.reseller.findUnique.mockResolvedValue(null);
      await expect(service.findAll({}, { sub: 'bad-reseller', role: 'RESELLER' }))
        .rejects.toThrow(ForbiddenException);
    });
  });

  describe('cleanupStaleSessions', () => {
    it('should mark stale sessions as disconnected', async () => {
      const staleNodes = [{ id: 'node-stale' }];
      prisma.vpnNode.findMany.mockResolvedValue(staleNodes);
      prisma.vpnSession.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.cleanupStaleSessions();
      expect(result).toEqual({ cleaned: 3 });
      expect(prisma.vpnSession.updateMany).toHaveBeenCalledWith({
        where: {
          vpnNodeId: { in: ['node-stale'] },
          disconnectedAt: null,
        },
        data: { disconnectedAt: expect.any(Date), kickedReason: 'stale_cleanup' },
      });
    });

    it('should return cleaned 0 when no stale nodes', async () => {
      prisma.vpnNode.findMany.mockResolvedValue([]);
      const result = await service.cleanupStaleSessions();
      expect(result).toEqual({ cleaned: 0 });
    });
  });
});

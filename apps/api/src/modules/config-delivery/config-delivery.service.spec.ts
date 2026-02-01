import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigDeliveryService } from './config-delivery.service';
import { PrismaService } from '../../common/prisma.service';
import { PkiService } from '../pki/pki.service';
import { getQueueToken } from '@nestjs/bullmq';

describe('ConfigDeliveryService', () => {
  let service: ConfigDeliveryService;
  let prisma: Record<string, any>;
  let pki: Record<string, any>;
  let emailQueue: Record<string, any>;

  const mockNode = {
    id: 'node-1',
    hostname: 'vpn.example.com',
    port: 1194,
  };

  beforeEach(async () => {
    prisma = {
      vpnNode: { findUnique: jest.fn() },
      certificate: { findUnique: jest.fn(), findMany: jest.fn() },
    };

    pki = {
      buildOvpnConfig: jest.fn().mockResolvedValue('client\ndev tun\n...'),
    };

    emailQueue = {
      add: jest.fn().mockResolvedValue({}),
    };

    const module = await Test.createTestingModule({
      providers: [
        ConfigDeliveryService,
        { provide: PrismaService, useValue: prisma },
        { provide: PkiService, useValue: pki },
        { provide: getQueueToken('email'), useValue: emailQueue },
      ],
    }).compile();

    service = module.get(ConfigDeliveryService);
  });

  describe('downloadConfig', () => {
    it('should return ovpn config for valid node and cert', async () => {
      prisma.vpnNode.findUnique.mockResolvedValue(mockNode);
      const result = await service.downloadConfig('cert-1', 'node-1');
      expect(result).toBe('client\ndev tun\n...');
      expect(pki.buildOvpnConfig).toHaveBeenCalledWith('cert-1', 'vpn.example.com', 1194);
    });

    it('should throw NotFoundException if node not found', async () => {
      prisma.vpnNode.findUnique.mockResolvedValue(null);
      await expect(service.downloadConfig('cert-1', 'bad-node')).rejects.toThrow(NotFoundException);
    });
  });

  describe('emailConfig', () => {
    it('should queue an email job', async () => {
      prisma.vpnNode.findUnique.mockResolvedValue(mockNode);
      const result = await service.emailConfig('cert-1', 'node-1', 'user@example.com');
      expect(result).toEqual({ queued: true });
      expect(emailQueue.add).toHaveBeenCalledWith('send-config', {
        to: 'user@example.com',
        subject: 'Your VPN Configuration',
        ovpnConfig: 'client\ndev tun\n...',
      });
    });
  });

  describe('assertCertOwnership', () => {
    it('should pass if cert belongs to user', async () => {
      prisma.certificate.findUnique.mockResolvedValue({ userId: 'user-1' });
      await expect(service.assertCertOwnership('cert-1', 'user-1')).resolves.not.toThrow();
    });

    it('should throw NotFoundException if cert not found', async () => {
      prisma.certificate.findUnique.mockResolvedValue(null);
      await expect(service.assertCertOwnership('bad-cert', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if cert belongs to another user', async () => {
      prisma.certificate.findUnique.mockResolvedValue({ userId: 'other-user' });
      await expect(service.assertCertOwnership('cert-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getUserCertificates', () => {
    it('should return non-revoked certificates for user', async () => {
      const certs = [
        { id: 'cert-1', commonName: 'client-1', createdAt: new Date() },
        { id: 'cert-2', commonName: 'client-2', createdAt: new Date() },
      ];
      prisma.certificate.findMany.mockResolvedValue(certs);
      const result = await service.getUserCertificates('user-1');
      expect(result).toEqual(certs);
      expect(prisma.certificate.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        select: { id: true, commonName: true, createdAt: true },
      });
    });
  });
});

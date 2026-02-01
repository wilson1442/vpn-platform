import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PkiService } from './pki.service';
import { PrismaService } from '../../common/prisma.service';
import { getQueueToken } from '@nestjs/bullmq';

// Mock external dependencies
jest.mock('node-forge', () => {
  const certMock = {
    publicKey: 'mock-pub-key',
    serialNumber: '',
    validity: { notBefore: new Date(), notAfter: new Date() },
    setSubject: jest.fn(),
    setIssuer: jest.fn(),
    setExtensions: jest.fn(),
    sign: jest.fn(),
    subject: { attributes: [{ name: 'commonName', value: 'VPN Platform CA' }] },
  };
  return {
    pki: {
      rsa: {
        generateKeyPair: jest.fn().mockReturnValue({
          publicKey: 'mock-pub-key',
          privateKey: 'mock-priv-key',
        }),
      },
      createCertificate: jest.fn().mockReturnValue({ ...certMock }),
      certificateToPem: jest.fn().mockReturnValue('-----BEGIN CERTIFICATE-----\nmock-cert\n-----END CERTIFICATE-----'),
      privateKeyToPem: jest.fn().mockReturnValue('-----BEGIN RSA PRIVATE KEY-----\nmock-key\n-----END RSA PRIVATE KEY-----'),
      certificateFromPem: jest.fn().mockReturnValue({
        subject: { attributes: [{ name: 'commonName', value: 'VPN Platform CA' }] },
      }),
      privateKeyFromPem: jest.fn().mockReturnValue('mock-priv-key'),
    },
    md: { sha256: { create: jest.fn().mockReturnValue({}) } },
  };
});

jest.mock('../../common/crypto.util', () => ({
  encryptAesGcm: jest.fn().mockReturnValue('encrypted-key'),
  decryptAesGcm: jest.fn().mockReturnValue('-----BEGIN RSA PRIVATE KEY-----\nmock-key\n-----END RSA PRIVATE KEY-----'),
}));

jest.mock('../../common/reseller-scope.util', () => ({
  getResellerSubtreeIds: jest.fn().mockResolvedValue(['reseller-1']),
}));

// Mock child_process and fs
jest.mock('child_process', () => ({
  execFile: jest.fn((_cmd, _args, cb) => cb(null, '', '')),
}));

jest.mock('fs/promises', () => ({
  mkdtemp: jest.fn().mockResolvedValue('/tmp/vpn-crl-mock'),
  writeFile: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue('-----BEGIN X509 CRL-----\nmock-crl\n-----END X509 CRL-----'),
  unlink: jest.fn().mockResolvedValue(undefined),
  rmdir: jest.fn().mockResolvedValue(undefined),
}));

describe('PkiService', () => {
  let service: PkiService;
  let prisma: Record<string, any>;
  let crlQueue: Record<string, any>;

  const mockCA = {
    id: 'ca-1',
    caCertPem: '-----BEGIN CERTIFICATE-----\nmock-ca-cert\n-----END CERTIFICATE-----',
    caKeyEncrypted: 'encrypted-key',
    crlPem: '-----BEGIN X509 CRL-----\nmock-crl\n-----END X509 CRL-----',
    crlVersion: 1,
    serialCounter: 2,
  };

  const mockCertRecord = {
    id: 'cert-1',
    userId: 'user-1',
    commonName: 'client-1',
    certPem: '-----BEGIN CERTIFICATE-----\nmock-cert\n-----END CERTIFICATE-----',
    keyEncrypted: 'encrypted-key',
    serialNumber: '02',
    revokedAt: null,
    user: { resellerId: 'reseller-1' },
  };

  beforeEach(async () => {
    prisma = {
      certificateAuthority: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      certificate: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      user: { findUnique: jest.fn() },
      reseller: { findUnique: jest.fn() },
      $queryRaw: jest.fn(),
    };

    crlQueue = {
      add: jest.fn().mockResolvedValue({}),
    };

    const module = await Test.createTestingModule({
      providers: [
        PkiService,
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken('crl-distribution'), useValue: crlQueue },
      ],
    }).compile();

    service = module.get(PkiService);
  });

  describe('initCA', () => {
    it('should create a new CA when none exists', async () => {
      prisma.certificateAuthority.findFirst.mockResolvedValue(null);
      prisma.certificateAuthority.create.mockResolvedValue(mockCA);

      const result = await service.initCA();
      expect(result).toEqual(mockCA);
      expect(prisma.certificateAuthority.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          caCertPem: expect.any(String),
          caKeyEncrypted: expect.any(String),
          crlPem: expect.any(String),
          crlVersion: 1,
          serialCounter: 2,
        }),
      });
    });

    it('should throw BadRequestException if CA already initialized', async () => {
      prisma.certificateAuthority.findFirst.mockResolvedValue(mockCA);
      await expect(service.initCA()).rejects.toThrow(BadRequestException);
    });
  });

  describe('issueCert', () => {
    it('should issue a certificate and increment serial counter', async () => {
      prisma.certificateAuthority.findFirst.mockResolvedValue(mockCA);
      prisma.certificateAuthority.update.mockResolvedValue({});
      prisma.certificate.create.mockResolvedValue(mockCertRecord);

      const result = await service.issueCert('user-1', 'client-1');
      expect(result).toEqual(mockCertRecord);
      expect(prisma.certificateAuthority.update).toHaveBeenCalledWith({
        where: { id: 'ca-1' },
        data: { serialCounter: 3 },
      });
    });

    it('should assert user scope for reseller actor', async () => {
      prisma.certificateAuthority.findFirst.mockResolvedValue(mockCA);
      prisma.certificateAuthority.update.mockResolvedValue({});
      prisma.certificate.create.mockResolvedValue(mockCertRecord);
      prisma.user.findUnique.mockResolvedValue({ resellerId: 'reseller-1' });
      prisma.reseller.findUnique.mockResolvedValue({ id: 'reseller-1' });

      const result = await service.issueCert('user-1', 'client-1', { sub: 'reseller-user-1', role: 'RESELLER' });
      expect(result).toEqual(mockCertRecord);
    });
  });

  describe('revokeCert', () => {
    it('should revoke a certificate and regenerate CRL', async () => {
      prisma.certificate.findUnique.mockResolvedValue(mockCertRecord);
      prisma.certificate.update.mockResolvedValue({});
      prisma.certificateAuthority.findFirst.mockResolvedValue(mockCA);
      prisma.certificate.findMany.mockResolvedValue([{ serialNumber: '02', revokedAt: new Date() }]);
      prisma.certificateAuthority.update.mockResolvedValue({});

      const result = await service.revokeCert('cert-1');
      expect(result).toEqual({ revoked: true });
      expect(prisma.certificate.update).toHaveBeenCalledWith({
        where: { id: 'cert-1' },
        data: { revokedAt: expect.any(Date) },
      });
      expect(crlQueue.add).toHaveBeenCalledWith('distribute-crl', expect.objectContaining({ crlVersion: 2 }));
    });

    it('should throw NotFoundException if cert not found', async () => {
      prisma.certificate.findUnique.mockResolvedValue(null);
      await expect(service.revokeCert('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if cert already revoked', async () => {
      prisma.certificate.findUnique.mockResolvedValue({ ...mockCertRecord, revokedAt: new Date() });
      await expect(service.revokeCert('cert-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException for wrong reseller', async () => {
      prisma.certificate.findUnique.mockResolvedValue({
        ...mockCertRecord,
        user: { resellerId: 'other-reseller' },
      });
      prisma.reseller.findUnique.mockResolvedValue({ id: 'reseller-1' });

      const { getResellerSubtreeIds } = require('../../common/reseller-scope.util');
      getResellerSubtreeIds.mockResolvedValue(['reseller-1']);

      await expect(
        service.revokeCert('cert-1', { sub: 'reseller-user-1', role: 'RESELLER' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getCA', () => {
    it('should return CA when initialized', async () => {
      prisma.certificateAuthority.findFirst.mockResolvedValue(mockCA);
      const result = await service.getCA();
      expect(result).toEqual(mockCA);
    });

    it('should throw BadRequestException when CA not initialized', async () => {
      prisma.certificateAuthority.findFirst.mockResolvedValue(null);
      await expect(service.getCA()).rejects.toThrow(BadRequestException);
    });
  });

  describe('getCRL', () => {
    it('should return CRL data', async () => {
      prisma.certificateAuthority.findFirst.mockResolvedValue(mockCA);
      const result = await service.getCRL();
      expect(result).toEqual({ crlPem: mockCA.crlPem, crlVersion: 1 });
    });
  });

  describe('buildOvpnConfig', () => {
    it('should build a valid ovpn config string', async () => {
      prisma.certificate.findUnique.mockResolvedValue(mockCertRecord);
      prisma.certificateAuthority.findFirst.mockResolvedValue(mockCA);

      const config = await service.buildOvpnConfig('cert-1', 'vpn.example.com', 1194);
      expect(config).toContain('client');
      expect(config).toContain('remote vpn.example.com 1194');
      expect(config).toContain('<ca>');
      expect(config).toContain('<cert>');
      expect(config).toContain('<key>');
    });

    it('should throw NotFoundException if cert not found', async () => {
      prisma.certificate.findUnique.mockResolvedValue(null);
      await expect(service.buildOvpnConfig('bad-id', 'host', 1194)).rejects.toThrow(NotFoundException);
    });
  });
});

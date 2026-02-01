import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../../common/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: Record<string, any>;

  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    passwordHash: '',
    role: 'USER',
    resellerId: null,
    isActive: true,
  };

  beforeAll(async () => {
    mockUser.passwordHash = await argon2.hash('password123');
  });

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
      refreshToken: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('mock-access-token') },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-secret') },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('login', () => {
    it('should return tokens for valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      const result = await service.login('test@test.com', 'password123');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should create a refresh token record on login', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      await service.login('test@test.com', 'password123');
      expect(prisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            tokenHash: expect.any(String),
            expiresAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should throw for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login('no@user.com', 'password123')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw for wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      await expect(service.login('test@test.com', 'wrong')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw for inactive user', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, isActive: false });
      await expect(service.login('test@test.com', 'password123')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('should throw for non-existent refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(service.refresh('bad-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw for revoked refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      });
      await expect(service.refresh('revoked-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw for expired refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.refresh('expired-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should rotate and return new tokens for valid refresh', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
      });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.refresh('valid-token');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'rt-1' } }),
      );
    });
  });

  describe('logout', () => {
    it('should revoke the refresh token', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
      await service.logout('some-token');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
    });

    it('should pass correct tokenHash to updateMany', async () => {
      const crypto = require('crypto');
      const token = 'my-refresh-token';
      const expectedHash = crypto.createHash('sha256').update(token).digest('hex');

      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
      await service.logout(token);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: expectedHash, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});

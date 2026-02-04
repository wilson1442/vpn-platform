import { Injectable, UnauthorizedException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma.service';
import { JWT_REFRESH_EXPIRES_MS } from '@vpn/shared';

const IMPERSONATION_EXPIRES_MS = 60 * 60 * 1000; // 1 hour

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');
    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.generateTokens(user);
  }

  async refresh(refreshToken: string) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Rotate: revoke old token
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || !user.isActive) throw new UnauthorizedException('User inactive');
    return this.generateTokens(user);
  }

  async logout(refreshToken: string) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async impersonate(adminUserId: string, adminEmail: string, targetUserId: string) {
    // Verify target user exists
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, username: true, email: true, role: true, resellerId: true, isActive: true },
    });

    if (!targetUser) {
      throw new NotFoundException('Target user not found');
    }

    // Cannot impersonate ADMIN users
    if (targetUser.role === 'ADMIN') {
      throw new ForbiddenException('Cannot impersonate admin users');
    }

    // Cannot impersonate inactive users
    if (!targetUser.isActive) {
      throw new ForbiddenException('Cannot impersonate inactive users');
    }

    return this.generateTokens(targetUser, {
      impersonatedBy: adminUserId,
      impersonatedByEmail: adminEmail,
      expiresMs: IMPERSONATION_EXPIRES_MS,
    });
  }

  private async generateTokens(
    user: { id: string; username: string; email: string | null; role: string; resellerId: string | null },
    options?: { impersonatedBy?: string; impersonatedByEmail?: string; expiresMs?: number },
  ) {
    const payload: Record<string, any> = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      resellerId: user.resellerId,
    };

    // Add impersonation metadata if present
    if (options?.impersonatedBy) {
      payload.impersonatedBy = options.impersonatedBy;
      payload.impersonatedByEmail = options.impersonatedByEmail;
    }

    const accessToken = this.jwt.sign(payload);

    const rawRefresh = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawRefresh).digest('hex');

    const expiresMs = options?.expiresMs ?? JWT_REFRESH_EXPIRES_MS;

    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt: new Date(Date.now() + expiresMs),
      },
    });

    return { accessToken, refreshToken: rawRefresh };
  }
}

import { Controller, Post, Get, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthService } from './auth.service';
import { Public, CurrentUser, Roles } from '../../common/decorators';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../audit/audit.service';

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: { username: string; password: string }) {
    return this.auth.login(body.username, body.password);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() body: { refreshToken: string }) {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Body() body: { refreshToken: string }) {
    return this.auth.logout(body.refreshToken);
  }

  @Get('me')
  async me(@CurrentUser() user: any) {
    const dbUser = await this.prisma.user.findUnique({ where: { id: user.sub }, select: { username: true, expiresAt: true, avatarPath: true } });
    return {
      id: user.sub,
      username: dbUser?.username ?? user.username,
      email: user.email,
      role: user.role,
      resellerId: user.resellerId,
      expiresAt: dbUser?.expiresAt ?? null,
      avatarPath: dbUser?.avatarPath ?? null,
      impersonatedBy: user.impersonatedBy,
      impersonatedByEmail: user.impersonatedByEmail,
    };
  }

  @Post('impersonate')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async impersonate(
    @CurrentUser() admin: any,
    @Body() body: { targetUserId: string },
  ) {
    const tokens = await this.auth.impersonate(admin.sub, admin.email, body.targetUserId);

    // Log to audit log
    await this.audit.log({
      actorId: admin.sub,
      action: 'IMPERSONATE',
      targetType: 'User',
      targetId: body.targetUserId,
      metadata: { adminEmail: admin.email },
    });

    return tokens;
  }
}

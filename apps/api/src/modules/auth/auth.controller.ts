import { Controller, Post, Get, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public, CurrentUser } from '../../common/decorators';
import { PrismaService } from '../../common/prisma.service';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService, private prisma: PrismaService) {}

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
    const dbUser = await this.prisma.user.findUnique({ where: { id: user.sub }, select: { username: true, expiresAt: true } });
    return { id: user.sub, username: dbUser?.username ?? user.username, email: user.email, role: user.role, resellerId: user.resellerId, expiresAt: dbUser?.expiresAt ?? null };
  }
}

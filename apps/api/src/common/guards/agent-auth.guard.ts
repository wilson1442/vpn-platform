import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_AGENT_AUTH_KEY } from '../decorators';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AgentAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isAgentAuth = this.reflector.getAllAndOverride<boolean>(IS_AGENT_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isAgentAuth) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing agent token');
    }

    const token = authHeader.slice(7);
    const node = await this.prisma.vpnNode.findUnique({ where: { agentToken: token } });
    if (!node) {
      throw new UnauthorizedException('Invalid agent token');
    }

    request.vpnNode = node;
    return true;
  }
}

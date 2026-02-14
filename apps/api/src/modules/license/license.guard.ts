import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, IS_AGENT_AUTH_KEY } from '../../common/decorators';
import { REQUIRE_FEATURE_KEY } from './license.constants';
import { LicenseService } from './license.service';

@Injectable()
export class LicenseFeatureGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private licenseService: LicenseService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const isAgentAuth = this.reflector.getAllAndOverride<boolean>(IS_AGENT_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isAgentAuth) return true;

    const feature = this.reflector.getAllAndOverride<string>(REQUIRE_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!feature) return true;

    if (!this.licenseService.hasFeature(feature)) {
      throw new ForbiddenException(`Feature '${feature}' requires an upgraded license`);
    }
    return true;
  }
}

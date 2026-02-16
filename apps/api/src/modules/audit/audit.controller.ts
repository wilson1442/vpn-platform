import { Controller, Delete, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser, Roles } from '../../common/decorators';
import { AuditService } from './audit.service';

@Controller('audit-logs')
export class AuditController {
  constructor(private audit: AuditService) {}

  @Delete()
  @Roles(Role.ADMIN)
  deleteAll() {
    return this.audit.deleteAll();
  }

  @Get()
  @Roles(Role.ADMIN)
  findAll(
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.audit.findAll({
      action,
      actorId,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('user-logs')
  @Roles(Role.ADMIN, Role.RESELLER)
  findUserLogs(
    @CurrentUser() user: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.audit.findUserLogs({
      actorId: user.role === Role.RESELLER ? user.sub : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }
}

import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { Roles, CurrentUser } from '../../common/decorators';

@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  @Roles(Role.ADMIN, Role.RESELLER)
  findAll(@CurrentUser() actor: any) {
    return this.users.findAll(actor);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: any) {
    return this.users.findOne(id, actor);
  }

  @Post()
  @Roles(Role.ADMIN, Role.RESELLER)
  create(@Body() body: { username: string; email?: string; password: string; role: Role; resellerId?: string; packageId?: string; expiresAt?: string }, @CurrentUser() actor: any) {
    return this.users.create(body, actor);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.RESELLER)
  update(@Param('id') id: string, @Body() body: { username?: string; email?: string; password?: string; role?: Role; isActive?: boolean; expiresAt?: string | null; maxConnections?: number }, @CurrentUser() actor: any) {
    return this.users.update(id, body, actor);
  }

  @Post(':id/extend')
  @Roles(Role.ADMIN, Role.RESELLER)
  extend(@Param('id') id: string, @Body() body: { packageId: string }, @CurrentUser() actor: any) {
    return this.users.extend(id, body.packageId, actor);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.RESELLER)
  delete(@Param('id') id: string, @CurrentUser() actor: any) {
    return this.users.delete(id, actor);
  }
}

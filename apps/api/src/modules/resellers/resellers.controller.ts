import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ResellersService } from './resellers.service';
import { Roles, CurrentUser } from '../../common/decorators';

@Controller('resellers')
export class ResellersController {
  constructor(private resellers: ResellersService) {}

  @Get()
  @Roles(Role.ADMIN, Role.RESELLER)
  findAll(@CurrentUser() actor: any) {
    return this.resellers.findAll(actor);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.RESELLER)
  findOne(@Param('id') id: string, @CurrentUser() actor: any) {
    return this.resellers.findOne(id, actor);
  }

  @Get(':id/tree')
  @Roles(Role.ADMIN, Role.RESELLER)
  getTree(@Param('id') id: string, @CurrentUser() actor: any) {
    return this.resellers.getTree(id, actor);
  }

  @Post()
  @Roles(Role.ADMIN, Role.RESELLER)
  create(@Body() body: { userId: string; companyName: string; parentId?: string; maxDepth?: number }, @CurrentUser() actor: any) {
    return this.resellers.create(body, actor);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.RESELLER)
  update(@Param('id') id: string, @Body() body: { companyName?: string; maxDepth?: number }, @CurrentUser() actor: any) {
    return this.resellers.update(id, body, actor);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.RESELLER)
  delete(@Param('id') id: string, @CurrentUser() actor: any) {
    return this.resellers.delete(id, actor);
  }
}

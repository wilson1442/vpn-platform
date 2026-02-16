import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators';
import { EmailTemplatesService } from './email-templates.service';

@Controller('email-templates')
export class EmailTemplatesController {
  constructor(private emailTemplates: EmailTemplatesService) {}

  @Get()
  @Roles(Role.ADMIN)
  findAll() {
    return this.emailTemplates.findAll();
  }

  @Get('variables/list')
  @Roles(Role.ADMIN)
  getVariables() {
    return this.emailTemplates.getAvailableVariables();
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  findOne(@Param('id') id: string) {
    return this.emailTemplates.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() body: { name: string; subject: string; htmlBody: string; description?: string }) {
    return this.emailTemplates.create(body);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() body: { name?: string; subject?: string; htmlBody?: string; description?: string; isActive?: boolean }) {
    return this.emailTemplates.update(id, body);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.emailTemplates.remove(id);
  }

  @Post(':id/preview')
  @Roles(Role.ADMIN)
  preview(@Param('id') id: string, @Body() body: { variables?: Record<string, string> }) {
    return this.emailTemplates.preview(id, body.variables);
  }

  @Post(':id/send-test')
  @Roles(Role.ADMIN)
  sendTest(@Param('id') id: string, @Body() body: { to: string; variables?: Record<string, string> }) {
    return this.emailTemplates.sendTest(id, body.to, body.variables);
  }
}

import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Res,
  NotFoundException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { Roles, Public } from '../../common/decorators';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private settings: SettingsService) {}

  @Get()
  @Roles(Role.ADMIN)
  getSettings() {
    return this.settings.getSettings();
  }

  @Get('public')
  @Public()
  getPublicSettings() {
    return this.settings.getPublicSettings();
  }

  @Get('version')
  @Public()
  getVersion() {
    return this.settings.getVersion();
  }

  @Get('changelog')
  @Public()
  getChangelog() {
    return this.settings.getChangelog();
  }

  @Patch()
  @Roles(Role.ADMIN)
  updateSettings(
    @Body()
    body: {
      siteName?: string;
      licenseKey?: string;
      githubRepo?: string;
      smtpHost?: string;
      smtpPort?: number;
      smtpUser?: string;
      smtpPass?: string;
      smtpFrom?: string;
      smtpSecure?: boolean;
    },
  ) {
    return this.settings.updateSettings(body);
  }

  @Post('test-email')
  @Roles(Role.ADMIN)
  testEmail(@Body() body: { to: string }) {
    return this.settings.testSmtp(body.to);
  }

  @Post('logo')
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  uploadLogo(@UploadedFile() file: { originalname: string; buffer: Buffer }) {
    return this.settings.uploadLogo(file);
  }

  @Get('logo')
  @Public()
  async serveLogo(@Res() res: Response) {
    const settings = await this.settings.getSettings();
    if (!settings.logoPath) {
      throw new NotFoundException('No logo uploaded');
    }
    const filePath = this.settings.getLogoPath(settings.logoPath);
    return res.sendFile(filePath);
  }

  @Post('backup')
  @Roles(Role.ADMIN)
  async createBackup(@Res() res: Response) {
    const { stdout } = await this.settings.createBackup();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader('Content-Type', 'application/sql');
    res.setHeader('Content-Disposition', `attachment; filename="backup-${timestamp}.sql"`);
    res.send(stdout);
  }

  @Post('update/check')
  @Roles(Role.ADMIN)
  checkForUpdates() {
    return this.settings.checkForUpdates();
  }

  @Post('update/download')
  @Roles(Role.ADMIN)
  downloadUpdate() {
    return this.settings.downloadUpdate();
  }

  @Post('update/apply')
  @Roles(Role.ADMIN)
  applyUpdate() {
    return this.settings.applyUpdate();
  }
}

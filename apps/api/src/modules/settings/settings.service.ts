import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { LicenseService } from '../license/license.service';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as nodemailer from 'nodemailer';

const execAsync = promisify(exec);

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private readonly uploadsDir = path.join(process.cwd(), 'uploads');
  private readonly repoDir = path.resolve(process.cwd(), '../..');

  constructor(
    private prisma: PrismaService,
    private licenseService: LicenseService,
  ) {
    if (!fsSync.existsSync(this.uploadsDir)) {
      fsSync.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  async getChangelog(): Promise<{ content: string }> {
    const changelogFile = path.join(this.repoDir, 'CHANGELOG.md');
    try {
      const content = await fs.readFile(changelogFile, 'utf-8');
      return { content };
    } catch {
      this.logger.warn('CHANGELOG.md not found');
      return { content: '# Changelog\n\nNo changelog available.' };
    }
  }

  async getVersion(): Promise<{ version: string; commit: string }> {
    const versionFile = path.join(this.repoDir, 'VERSION');
    let version = '0.0.0';
    let commit = 'unknown';

    try {
      version = (await fs.readFile(versionFile, 'utf-8')).trim();
    } catch {
      this.logger.warn('VERSION file not found');
    }

    try {
      const { stdout } = await execAsync('git rev-parse --short HEAD', { cwd: this.repoDir });
      commit = stdout.trim();
    } catch {
      this.logger.warn('Could not get git commit');
    }

    return { version, commit };
  }

  async getSettings() {
    return this.prisma.appSettings.upsert({
      where: { id: 'singleton' },
      create: {},
      update: {},
    });
  }

  async getPublicSettings() {
    const settings = await this.getSettings();
    return { siteName: settings.siteName, logoPath: settings.logoPath };
  }

  async updateSettings(data: {
    siteName?: string;
    licenseKey?: string;
    githubRepo?: string;
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPass?: string;
    smtpFrom?: string;
    smtpSecure?: boolean;
  }) {
    const settings = await this.prisma.appSettings.upsert({
      where: { id: 'singleton' },
      create: { ...data },
      update: { ...data },
    });

    if ('licenseKey' in data) {
      const licenseStatus = await this.licenseService.reinitialize(data.licenseKey || null);
      return { ...settings, licenseStatus };
    }

    return settings;
  }

  async uploadLogo(file: { originalname: string; buffer: Buffer }) {
    const ext = path.extname(file.originalname) || '.png';
    const filename = `logo${ext}`;
    const filePath = path.join(this.uploadsDir, filename);

    fsSync.writeFileSync(filePath, file.buffer);

    return this.prisma.appSettings.upsert({
      where: { id: 'singleton' },
      create: { logoPath: filename },
      update: { logoPath: filename },
    });
  }

  getLogoPath(filename: string): string {
    return path.join(this.uploadsDir, filename);
  }

  async createBackup(): Promise<{ stdout: string }> {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL not configured');
    }

    const { stdout } = await execAsync(`pg_dump "${databaseUrl}"`, {
      maxBuffer: 100 * 1024 * 1024,
    });
    return { stdout };
  }

  async checkForUpdates(): Promise<{
    currentVersion: string;
    latestVersion: string;
    currentCommit: string;
    remoteCommit: string;
    behindBy: number;
    releaseNotes: string[];
  }> {
    await execAsync('git fetch origin', { cwd: this.repoDir });

    const { stdout: currentCommit } = await execAsync('git rev-parse HEAD', { cwd: this.repoDir });
    const { stdout: remoteCommit } = await execAsync('git rev-parse @{u}', { cwd: this.repoDir });
    const { stdout: behindCount } = await execAsync('git rev-list HEAD..@{u} --count', { cwd: this.repoDir });

    const { version: currentVersion } = await this.getVersion();

    let latestVersion = currentVersion;
    try {
      const { stdout: remoteVersionContent } = await execAsync(
        'git show @{u}:VERSION',
        { cwd: this.repoDir },
      );
      latestVersion = remoteVersionContent.trim();
    } catch {
      this.logger.warn('Could not read remote VERSION file');
    }

    let releaseNotes: string[] = [];
    const behindBy = parseInt(behindCount.trim(), 10);
    if (behindBy > 0) {
      try {
        const { stdout: logOutput } = await execAsync(
          'git log HEAD..@{u} --pretty=format:"%s"',
          { cwd: this.repoDir },
        );
        releaseNotes = logOutput.trim().split('\n').filter(Boolean);
      } catch {
        this.logger.warn('Could not get commit messages');
      }
    }

    return {
      currentVersion,
      latestVersion,
      currentCommit: currentCommit.trim(),
      remoteCommit: remoteCommit.trim(),
      behindBy,
      releaseNotes,
    };
  }

  async downloadUpdate(): Promise<{ success: boolean; message: string }> {
    try {
      await execAsync('git fetch origin', { cwd: this.repoDir });
      return { success: true, message: 'Update downloaded successfully' };
    } catch (error: any) {
      return { success: false, message: error.message || 'Failed to download update' };
    }
  }

  async getSmtpSettings() {
    const settings = await this.getSettings();
    return {
      host: settings.smtpHost || undefined,
      port: settings.smtpPort || undefined,
      user: settings.smtpUser || undefined,
      pass: settings.smtpPass || undefined,
      from: settings.smtpFrom || undefined,
      secure: settings.smtpSecure,
    };
  }

  async testSmtp(to: string): Promise<{ success: boolean; message: string }> {
    const smtp = await this.getSmtpSettings();
    if (!smtp.host) {
      throw new Error('SMTP host is not configured');
    }

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port || 587,
      secure: smtp.secure,
      ...(smtp.user && smtp.pass
        ? { auth: { user: smtp.user, pass: smtp.pass } }
        : {}),
    });

    try {
      await transporter.sendMail({
        from: smtp.from || `noreply@${smtp.host}`,
        to,
        subject: 'SMTP Test Email',
        text: 'This is a test email from your VPN Platform. If you received this, your SMTP settings are configured correctly.',
      });
      return { success: true, message: `Test email sent to ${to}` };
    } catch (error: any) {
      return { success: false, message: error.message || 'Failed to send test email' };
    }
  }

  async applyUpdate(): Promise<{ success: boolean; output: string; newVersion: string }> {
    const outputs: string[] = [];

    try {
      // Git pull
      const { stdout: pullOut, stderr: pullErr } = await execAsync('git pull', { cwd: this.repoDir });
      outputs.push('=== Git Pull ===', pullOut, pullErr || '');

      // Install dependencies
      const { stdout: installOut, stderr: installErr } = await execAsync('pnpm install --frozen-lockfile', {
        cwd: this.repoDir,
        timeout: 300000, // 5 minutes
      });
      outputs.push('=== Install Dependencies ===', installOut, installErr || '');

      // Run migrations
      const { stdout: migrateOut, stderr: migrateErr } = await execAsync('pnpm db:migrate', {
        cwd: this.repoDir,
        timeout: 120000, // 2 minutes
      });
      outputs.push('=== Database Migration ===', migrateOut, migrateErr || '');

      // Build
      const { stdout: buildOut, stderr: buildErr } = await execAsync('pnpm build', {
        cwd: this.repoDir,
        timeout: 600000, // 10 minutes
      });
      outputs.push('=== Build ===', buildOut, buildErr || '');

      // Copy static files for Next.js standalone build
      const webDir = path.join(this.repoDir, 'apps/web');
      const standaloneWebDir = path.join(webDir, '.next/standalone/apps/web');
      try {
        await execAsync(`cp -r ${webDir}/public ${standaloneWebDir}/`, { cwd: this.repoDir });
        await execAsync(`mkdir -p ${standaloneWebDir}/.next && cp -r ${webDir}/.next/static ${standaloneWebDir}/.next/`, { cwd: this.repoDir });
        outputs.push('=== Static Files ===', 'Copied static files to standalone build');
      } catch (copyErr: any) {
        outputs.push('=== Static Files Warning ===', copyErr.message || 'Failed to copy static files');
      }

      const { version: newVersion } = await this.getVersion();

      return {
        success: true,
        output: outputs.filter(Boolean).join('\n'),
        newVersion,
      };
    } catch (error: any) {
      outputs.push('=== Error ===', error.message || 'Unknown error');
      const { version: newVersion } = await this.getVersion();
      return {
        success: false,
        output: outputs.filter(Boolean).join('\n'),
        newVersion,
      };
    }
  }
}

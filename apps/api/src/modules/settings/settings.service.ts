import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private readonly uploadsDir = path.join(process.cwd(), 'uploads');

  constructor(private prisma: PrismaService) {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
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

  async updateSettings(data: { siteName?: string; licenseKey?: string; githubRepo?: string }) {
    return this.prisma.appSettings.upsert({
      where: { id: 'singleton' },
      create: { ...data },
      update: { ...data },
    });
  }

  async uploadLogo(file: { originalname: string; buffer: Buffer }) {
    const ext = path.extname(file.originalname) || '.png';
    const filename = `logo${ext}`;
    const filePath = path.join(this.uploadsDir, filename);

    fs.writeFileSync(filePath, file.buffer);

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

  async checkForUpdates(): Promise<{ currentCommit: string; remoteCommit: string; behindBy: number }> {
    const repoDir = process.cwd();

    await execAsync('git fetch origin', { cwd: repoDir });

    const { stdout: currentCommit } = await execAsync('git rev-parse HEAD', { cwd: repoDir });
    const { stdout: remoteCommit } = await execAsync('git rev-parse @{u}', { cwd: repoDir });
    const { stdout: behindCount } = await execAsync('git rev-list HEAD..@{u} --count', { cwd: repoDir });

    return {
      currentCommit: currentCommit.trim(),
      remoteCommit: remoteCommit.trim(),
      behindBy: parseInt(behindCount.trim(), 10),
    };
  }

  async applyUpdate(): Promise<{ output: string }> {
    const repoDir = process.cwd();
    const { stdout, stderr } = await execAsync('git pull', { cwd: repoDir });
    return { output: stdout + (stderr ? `\n${stderr}` : '') };
  }
}

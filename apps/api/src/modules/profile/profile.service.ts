import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';

@Injectable()
export class ProfileService {
  private readonly uploadsDir = path.join(process.cwd(), 'uploads', 'avatars');

  constructor(private prisma: PrismaService) {
    if (!fsSync.existsSync(this.uploadsDir)) {
      fsSync.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        avatarPath: true,
        createdAt: true,
      },
    });
    return user;
  }

  async uploadAvatar(userId: string, file: { originalname: string; buffer: Buffer }) {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const filename = `${userId}${ext}`;
    const filePath = path.join(this.uploadsDir, filename);

    // Remove any existing avatar for this user
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarPath: true },
    });
    if (existing?.avatarPath) {
      const oldPath = path.join(this.uploadsDir, existing.avatarPath);
      try {
        await fs.unlink(oldPath);
      } catch {}
    }

    await fs.writeFile(filePath, file.buffer);

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarPath: filename },
    });

    return { avatarPath: filename };
  }

  getAvatarFilePath(filename: string): string {
    return path.resolve(this.uploadsDir, filename);
  }

  async getAvatarPathForUser(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarPath: true },
    });
    return user?.avatarPath ?? null;
  }
}

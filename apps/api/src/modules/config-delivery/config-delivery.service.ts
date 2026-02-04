import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../common/prisma.service';
import { PkiService } from '../pki/pki.service';

@Injectable()
export class ConfigDeliveryService {
  private readonly logger = new Logger(ConfigDeliveryService.name);

  constructor(
    private prisma: PrismaService,
    private pki: PkiService,
    @InjectQueue('email') private emailQueue: Queue,
  ) {}

  async getAvailableNodes() {
    return this.prisma.vpnNode.findMany({
      where: { isActive: true },
      select: { id: true, name: true, hostname: true, port: true },
      orderBy: { name: 'asc' },
    });
  }

  async getNodeProfile(vpnNodeId: string, userId: string) {
    const node = await this.prisma.vpnNode.findUnique({ where: { id: vpnNodeId } });
    if (!node) throw new NotFoundException('VPN node not found');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { entitlement: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.entitlement || !user.entitlement.isActive) {
      throw new BadRequestException('You need an active subscription to download VPN profiles');
    }

    return this.pki.buildNodeProfile(node.hostname, node.port);
  }

  async generateConfig(userId: string, deviceName: string, vpnNodeId: string) {
    // Validate the node exists
    const node = await this.prisma.vpnNode.findUnique({ where: { id: vpnNodeId } });
    if (!node) throw new NotFoundException('VPN node not found');

    // Validate user has an active entitlement
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { entitlement: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.entitlement || !user.entitlement.isActive) {
      throw new BadRequestException('You need an active subscription to generate VPN configs');
    }

    // Check device limit
    const existingCerts = await this.prisma.certificate.count({
      where: { userId, revokedAt: null },
    });
    if (existingCerts >= user.entitlement.maxDevices) {
      throw new BadRequestException(
        `Device limit reached (${user.entitlement.maxDevices}). Delete an existing config first.`,
      );
    }

    // Build common name: username-devicename
    const commonName = `${user.username}-${deviceName}`;

    // Check if commonName is already taken
    const existing = await this.prisma.certificate.findUnique({ where: { commonName } });
    if (existing && !existing.revokedAt) {
      throw new BadRequestException(`A config with name "${commonName}" already exists`);
    }

    // Issue the certificate
    const cert = await this.pki.issueCert(userId, commonName);

    // Build and return the ovpn config
    const ovpnConfig = await this.pki.buildOvpnConfig(cert.id, node.hostname, node.port);

    return {
      certificate: {
        id: cert.id,
        commonName: cert.commonName,
        createdAt: cert.createdAt,
      },
      ovpnConfig,
      nodeName: node.name,
    };
  }

  async downloadConfig(certId: string, vpnNodeId: string) {
    const node = await this.prisma.vpnNode.findUnique({ where: { id: vpnNodeId } });
    if (!node) throw new NotFoundException('VPN node not found');
    return this.pki.buildOvpnConfig(certId, node.hostname, node.port);
  }

  async emailConfig(certId: string, vpnNodeId: string, recipientEmail: string) {
    const config = await this.downloadConfig(certId, vpnNodeId);
    await this.emailQueue.add('send-config', {
      to: recipientEmail,
      subject: 'Your VPN Configuration',
      ovpnConfig: config,
    });
    return { queued: true };
  }

  async assertCertOwnership(certId: string, userId: string) {
    const cert = await this.prisma.certificate.findUnique({ where: { id: certId }, select: { userId: true } });
    if (!cert) throw new NotFoundException('Certificate not found');
    if (cert.userId !== userId) throw new ForbiddenException('Certificate does not belong to you');
  }

  async getUserCertificates(userId: string) {
    return this.prisma.certificate.findMany({
      where: { userId, revokedAt: null },
      select: { id: true, commonName: true, createdAt: true },
    });
  }

  async deleteCertificate(certId: string) {
    return this.pki.revokeCert(certId);
  }

  async getOrCreateAccessToken(userId: string) {
    const existing = await this.prisma.profileAccessToken.findUnique({
      where: { userId },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.profileAccessToken.create({
      data: {
        userId,
        token: randomBytes(32).toString('hex'),
      },
    });
  }

  async regenerateAccessToken(userId: string) {
    return this.prisma.profileAccessToken.upsert({
      where: { userId },
      update: { token: randomBytes(32).toString('hex') },
      create: {
        userId,
        token: randomBytes(32).toString('hex'),
      },
    });
  }

  async getProfileByToken(token: string, vpnNodeId?: string) {
    const accessToken = await this.prisma.profileAccessToken.findUnique({
      where: { token },
      include: {
        user: {
          include: { entitlement: true },
        },
      },
    });
    if (!accessToken) throw new NotFoundException('Invalid access token');

    const user = accessToken.user;
    if (!user.isActive) throw new ForbiddenException('Account is disabled');
    if (!user.entitlement || !user.entitlement.isActive) {
      throw new ForbiddenException('No active subscription');
    }

    // If no specific node requested, return first active node's profile
    let node;
    if (vpnNodeId) {
      node = await this.prisma.vpnNode.findUnique({ where: { id: vpnNodeId } });
      if (!node || !node.isActive) throw new NotFoundException('VPN node not found');
    } else {
      node = await this.prisma.vpnNode.findFirst({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
      if (!node) throw new NotFoundException('No VPN servers available');
    }

    return {
      config: await this.pki.buildNodeProfile(node.hostname, node.port),
      nodeName: node.name,
    };
  }

  private generateShortCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const bytes = randomBytes(8);
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars[bytes[i] % chars.length];
    }
    return code;
  }

  private async createTinyUrl(longUrl: string): Promise<string | null> {
    try {
      const response = await fetch(
        `https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`,
      );

      if (!response.ok) {
        this.logger.warn(`TinyURL API error: ${response.status}`);
        return null;
      }

      const shortUrl = await response.text();
      if (!shortUrl.startsWith('https://tinyurl.com/')) {
        this.logger.warn(`TinyURL returned unexpected response: ${shortUrl}`);
        return null;
      }

      return shortUrl;
    } catch (err) {
      this.logger.warn(`TinyURL API failed: ${(err as Error).message}`);
      return null;
    }
  }

  async getOrCreateShortUrl(userId: string, vpnNodeId: string, baseUrl?: string) {
    // Check user has active entitlement
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { entitlement: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.entitlement || !user.entitlement.isActive) {
      throw new BadRequestException('You need an active subscription');
    }

    // Check node exists
    const node = await this.prisma.vpnNode.findUnique({ where: { id: vpnNodeId } });
    if (!node || !node.isActive) throw new NotFoundException('VPN node not found');

    // Find existing or create new
    const existing = await this.prisma.shortUrl.findUnique({
      where: { userId_vpnNodeId: { userId, vpnNodeId } },
    });
    if (existing) {
      return { code: existing.code, shortUrl: existing.shortUrl, nodeName: node.name };
    }

    // Generate unique code
    let code: string;
    let attempts = 0;
    do {
      code = this.generateShortCode();
      const exists = await this.prisma.shortUrl.findUnique({ where: { code } });
      if (!exists) break;
      attempts++;
    } while (attempts < 10);

    // Try to create TinyURL short URL
    let tinyUrl: string | null = null;
    if (baseUrl) {
      const longUrl = `${baseUrl}/configs/p/${code}`;
      tinyUrl = await this.createTinyUrl(longUrl);
    }

    const shortUrlRecord = await this.prisma.shortUrl.create({
      data: { code, userId, vpnNodeId, shortUrl: tinyUrl },
    });

    return { code: shortUrlRecord.code, shortUrl: shortUrlRecord.shortUrl, nodeName: node.name };
  }

  async regenerateShortUrl(userId: string, vpnNodeId: string, baseUrl?: string) {
    const node = await this.prisma.vpnNode.findUnique({ where: { id: vpnNodeId } });
    if (!node || !node.isActive) throw new NotFoundException('VPN node not found');

    // Delete existing if any
    await this.prisma.shortUrl.deleteMany({
      where: { userId, vpnNodeId },
    });

    // Create new
    return this.getOrCreateShortUrl(userId, vpnNodeId, baseUrl);
  }

  async getShortUrls(userId: string) {
    return this.prisma.shortUrl.findMany({
      where: { userId },
      select: { code: true, shortUrl: true, vpnNodeId: true },
    });
  }

  async getOrCreateAllShortUrls(userId: string, baseUrl?: string) {
    // Check user has active entitlement
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { entitlement: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.entitlement || !user.entitlement.isActive) {
      throw new BadRequestException('You need an active subscription');
    }

    // Get all active VPN nodes
    const nodes = await this.prisma.vpnNode.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    if (nodes.length === 0) {
      throw new NotFoundException('No VPN servers available');
    }

    const results: Array<{ code: string; shortUrl: string | null; nodeName: string; vpnNodeId: string }> = [];

    for (const node of nodes) {
      // Check if already exists
      const existing = await this.prisma.shortUrl.findUnique({
        where: { userId_vpnNodeId: { userId, vpnNodeId: node.id } },
      });

      if (existing) {
        results.push({
          code: existing.code,
          shortUrl: existing.shortUrl,
          nodeName: node.name,
          vpnNodeId: node.id,
        });
        continue;
      }

      // Generate unique code
      let code: string;
      let attempts = 0;
      do {
        code = this.generateShortCode();
        const exists = await this.prisma.shortUrl.findUnique({ where: { code } });
        if (!exists) break;
        attempts++;
      } while (attempts < 10);

      // Try to create TinyURL
      let tinyUrl: string | null = null;
      if (baseUrl) {
        const longUrl = `${baseUrl}/configs/p/${code}`;
        tinyUrl = await this.createTinyUrl(longUrl);
      }

      const shortUrlRecord = await this.prisma.shortUrl.create({
        data: { code, userId, vpnNodeId: node.id, shortUrl: tinyUrl },
      });

      results.push({
        code: shortUrlRecord.code,
        shortUrl: shortUrlRecord.shortUrl,
        nodeName: node.name,
        vpnNodeId: node.id,
      });
    }

    return results;
  }

  async getProfileByShortCode(code: string) {
    const shortUrl = await this.prisma.shortUrl.findUnique({
      where: { code },
      include: {
        user: { include: { entitlement: true } },
        vpnNode: true,
      },
    });
    if (!shortUrl) throw new NotFoundException('Invalid URL');

    const user = shortUrl.user;
    if (!user.isActive) throw new ForbiddenException('Account is disabled');
    if (!user.entitlement || !user.entitlement.isActive) {
      throw new ForbiddenException('No active subscription');
    }

    const node = shortUrl.vpnNode;
    if (!node.isActive) throw new NotFoundException('Server unavailable');

    return {
      config: await this.pki.buildNodeProfile(node.hostname, node.port),
      nodeName: node.name,
    };
  }
}

import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma.service';
import { PkiService } from '../pki/pki.service';

@Injectable()
export class ConfigDeliveryService {
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
}

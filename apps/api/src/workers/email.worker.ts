import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../common/prisma.service';

@Processor('email')
export class EmailWorker extends WorkerHost {
  private readonly logger = new Logger(EmailWorker.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  private async createTransporter(): Promise<nodemailer.Transporter> {
    const settings = await this.prisma.appSettings
      .findUnique({ where: { id: 'singleton' } })
      .catch(() => null);

    const host = settings?.smtpHost || process.env.SMTP_HOST || 'localhost';
    const port = settings?.smtpPort || parseInt(process.env.SMTP_PORT || '1025', 10);
    const secure = settings?.smtpSecure ?? false;
    const user = settings?.smtpUser || undefined;
    const pass = settings?.smtpPass || undefined;

    return nodemailer.createTransport({
      host,
      port,
      secure,
      ...(user && pass ? { auth: { user, pass } } : {}),
    });
  }

  async process(job: Job<{ to: string; subject: string; ovpnConfig: string }>) {
    const { to, subject, ovpnConfig } = job.data;
    const transporter = await this.createTransporter();

    const settings = await this.prisma.appSettings
      .findUnique({ where: { id: 'singleton' } })
      .catch(() => null);

    const from = settings?.smtpFrom || process.env.SMTP_FROM || 'noreply@vpn-platform.local';

    await transporter.sendMail({
      from,
      to,
      subject,
      text: 'Please find your VPN configuration file attached.',
      attachments: [
        {
          filename: 'client.ovpn',
          content: ovpnConfig,
          contentType: 'application/x-openvpn-profile',
        },
      ],
    });

    this.logger.log(`Config email sent to ${to}`);
  }
}

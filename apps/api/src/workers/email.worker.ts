import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import * as nodemailer from 'nodemailer';

@Processor('email')
export class EmailWorker extends WorkerHost {
  private readonly logger = new Logger(EmailWorker.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    super();
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '1025', 10),
      secure: false,
    });
  }

  async process(job: Job<{ to: string; subject: string; ovpnConfig: string }>) {
    const { to, subject, ovpnConfig } = job.data;

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@vpn-platform.local',
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

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { SettingsService } from '../settings/settings.service';
import * as nodemailer from 'nodemailer';

const AVAILABLE_VARIABLES = [
  { key: 'username', description: "The recipient's username" },
  { key: 'email', description: "The recipient's email address" },
  { key: 'site_name', description: 'Name of the VPN platform' },
  { key: 'expiry_date', description: "User's subscription expiry date" },
  { key: 'package_name', description: "User's current package name" },
  { key: 'login_url', description: 'URL to the login page' },
  { key: 'current_date', description: "Today's date" },
  { key: 'support_email', description: 'Support contact email address' },
];

@Injectable()
export class EmailTemplatesService {
  private readonly logger = new Logger(EmailTemplatesService.name);

  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
  ) {}

  async findAll() {
    return this.prisma.emailTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const template = await this.prisma.emailTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async create(data: { name: string; subject: string; htmlBody: string; description?: string }) {
    return this.prisma.emailTemplate.create({
      data: {
        name: data.name,
        subject: data.subject,
        htmlBody: data.htmlBody,
        description: data.description || '',
      },
    });
  }

  async update(id: string, data: { name?: string; subject?: string; htmlBody?: string; description?: string; isActive?: boolean }) {
    await this.findOne(id);
    return this.prisma.emailTemplate.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.emailTemplate.delete({ where: { id } });
  }

  getAvailableVariables() {
    return AVAILABLE_VARIABLES;
  }

  renderTemplate(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] !== undefined ? variables[key] : match;
    });
  }

  async preview(id: string, variables?: Record<string, string>) {
    const template = await this.findOne(id);
    const vars = this.getSampleVariables(variables);
    return {
      subject: this.renderTemplate(template.subject, vars),
      html: this.renderTemplate(template.htmlBody, vars),
    };
  }

  async sendTest(id: string, to: string, variables?: Record<string, string>) {
    const template = await this.findOne(id);
    const vars = this.getSampleVariables(variables);

    const renderedSubject = this.renderTemplate(template.subject, vars);
    const renderedHtml = this.renderTemplate(template.htmlBody, vars);

    const smtp = await this.settings.getSmtpSettings();
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
        subject: renderedSubject,
        html: renderedHtml,
      });
      return { success: true, message: `Test email sent to ${to}` };
    } catch (error: any) {
      return { success: false, message: error.message || 'Failed to send test email' };
    }
  }

  private getSampleVariables(overrides?: Record<string, string>): Record<string, string> {
    const defaults: Record<string, string> = {
      username: 'john_doe',
      email: 'john@example.com',
      site_name: 'VPN Platform',
      expiry_date: '2026-03-15',
      package_name: 'Premium Monthly',
      login_url: 'https://vpn.example.com/login',
      current_date: new Date().toISOString().split('T')[0],
      support_email: 'support@vpn.example.com',
    };
    return { ...defaults, ...overrides };
  }
}

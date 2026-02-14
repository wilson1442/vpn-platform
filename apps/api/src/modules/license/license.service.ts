import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import {
  LICENSE_SERVER_URL,
  LICENSE_PUBLIC_KEY,
  VALIDATE_INTERVAL,
  HEARTBEAT_INTERVAL,
  OFFLINE_GRACE_PERIOD,
  PANEL_GRACE_PERIOD_DAYS,
} from './license.constants';

// Dynamic import for the ESM SDK — use Function to prevent TS from converting to require()
type LicenseForgeType = import('@licenseforge/node-sdk').LicenseForge;
type LicenseInfoType = import('@licenseforge/node-sdk').LicenseInfo;

const importDynamic = new Function('modulePath', 'return import(modulePath)');

async function loadSdk(): Promise<typeof import('@licenseforge/node-sdk')> {
  return importDynamic('@licenseforge/node-sdk');
}

@Injectable()
export class LicenseService implements OnModuleInit {
  private readonly logger = new Logger(LicenseService.name);
  private lf: LicenseForgeType | null = null;
  private initError: string | null = null;
  private licenseKey: string | null = null;
  private statusData: { tier?: string; product?: string; expiresAt?: string | null } | null = null;

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    const settings = await this.prisma.appSettings.findUnique({ where: { id: 'singleton' } });
    if (settings?.licenseKey) {
      await this.initialize(settings.licenseKey);
    }
  }

  private async initialize(licenseKey: string) {
    this.licenseKey = licenseKey;
    let validationError: string | null = null;

    try {
      const { LicenseForge } = await loadSdk();
      this.lf = new LicenseForge({
        serverUrl: LICENSE_SERVER_URL,
        productSlug: 'vpn-platform',
        licenseKey,
        publicKey: LICENSE_PUBLIC_KEY,
        validateInterval: VALIDATE_INTERVAL,
        heartbeatInterval: HEARTBEAT_INTERVAL,
        offlineGracePeriod: OFFLINE_GRACE_PERIOD,
        onValidationFailed: (reason, details?: unknown) => {
          const apiCode = details && typeof details === 'object' && 'code' in details
            ? (details as any).code : null;
          const httpStatus = details && typeof details === 'object' && 'status' in details
            ? (details as any).status : null;

          if (httpStatus === 500 || apiCode === 'INTERNAL_ERROR') {
            validationError = 'License server returned an error. Please try again later.';
          } else if (httpStatus === 404 || apiCode === 'NOT_FOUND' || apiCode === 'LICENSE_NOT_FOUND') {
            validationError = 'License key not found. Please check your key and try again.';
          } else if (apiCode === 'LICENSE_EXPIRED') {
            validationError = 'This license has expired.';
          } else if (apiCode === 'LICENSE_SUSPENDED') {
            validationError = 'This license has been suspended.';
          } else if (apiCode === 'PRODUCT_MISMATCH') {
            validationError = 'License key does not match this product.';
          } else if (apiCode) {
            validationError = `${reason} (${apiCode})`;
          } else {
            validationError = reason;
          }
          this.logger.warn(`License validation failed: ${validationError} [code=${apiCode}, status=${httpStatus}]`);
        },
        onGracePeriod: (daysLeft) => {
          this.logger.warn(`License in grace period: ${daysLeft} days left`);
        },
      });
      await this.lf.initialize();

      if (!this.lf.isValid()) {
        this.initError = validationError || 'License validation failed';
        this.logger.error(`License invalid after init: ${this.initError}`);
      } else {
        this.initError = null;
        this.logger.log('License initialized successfully');
        await this.fetchLicenseDetails(licenseKey);
      }
    } catch (err: any) {
      this.initError = err.message || 'Failed to initialize license';
      this.logger.error(`License initialization failed: ${this.initError}`);
      this.lf = null;
    }
  }

  private async fetchLicenseDetails(licenseKey: string) {
    try {
      const url = `${LICENSE_SERVER_URL}/api/v1/license/status/${encodeURIComponent(licenseKey)}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (resp.ok) {
        const json = await resp.json() as {
          success?: boolean;
          data?: { tier?: string; product?: string; expiresAt?: string | null };
        };
        if (json.success && json.data) {
          this.statusData = json.data;
        }
      }
    } catch {
      // Non-critical
    }
  }

  async reinitialize(licenseKey: string | null) {
    if (this.lf) {
      try {
        await this.lf.deactivate();
      } catch {
        // Best effort cleanup
      }
      this.lf = null;
      this.initError = null;
      this.statusData = null;
    }

    if (licenseKey) {
      await this.initialize(licenseKey);
    } else {
      this.licenseKey = null;
    }

    return this.getStatus();
  }

  isValid(): boolean {
    return this.lf?.isValid() ?? false;
  }

  hasFeature(slug: string): boolean {
    if (!this.lf?.isValid()) return false;
    // Don't use SDK's hasFeature() — it crashes when features is an object (not array).
    // Check manually using getLicenseInfo().
    const info = this.lf.getLicenseInfo();
    const features = info.features;
    if (Array.isArray(features)) return features.includes(slug);
    if (features && typeof features === 'object') return slug in features;
    return false;
  }

  private async updateGracePeriod(isActive: boolean): Promise<{ gracePeriodEndsAt: string | null; locked: boolean }> {
    const settings = await this.prisma.appSettings.findUnique({ where: { id: 'singleton' } });
    if (!settings) return { gracePeriodEndsAt: null, locked: false };

    if (isActive) {
      // License is active — clear grace period if set
      if (settings.licenseGraceStart) {
        await this.prisma.appSettings.update({
          where: { id: 'singleton' },
          data: { licenseGraceStart: null },
        });
      }
      return { gracePeriodEndsAt: null, locked: false };
    }

    // License is NOT active — start or continue grace period
    let graceStart = settings.licenseGraceStart;
    if (!graceStart) {
      graceStart = new Date();
      await this.prisma.appSettings.update({
        where: { id: 'singleton' },
        data: { licenseGraceStart: graceStart },
      });
    }

    const endsAt = new Date(graceStart.getTime() + PANEL_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
    const locked = new Date() > endsAt;
    return { gracePeriodEndsAt: endsAt.toISOString(), locked };
  }

  async getStatus() {
    if (!this.lf) {
      const grace = await this.updateGracePeriod(false);
      return {
        valid: false,
        status: 'no_license',
        tier: null as string | null,
        expiresAt: null as string | null,
        features: [] as string[],
        product: null as string | null,
        initError: this.initError,
        ...grace,
      };
    }

    const info: LicenseInfoType = this.lf.getLicenseInfo();
    // SDK returns features as Record<string, unknown>; convert keys to string[]
    const features = info.features && typeof info.features === 'object' && !Array.isArray(info.features)
      ? Object.keys(info.features)
      : Array.isArray(info.features) ? info.features : [];
    const isActive = info.status === 'active';
    const grace = await this.updateGracePeriod(isActive);
    return {
      valid: info.valid,
      status: info.status,
      tier: info.tier || this.statusData?.tier || null,
      expiresAt: info.expiresAt || this.statusData?.expiresAt || null,
      features,
      product: this.statusData?.product || null,
      initError: this.initError,
      ...grace,
    };
  }

  async getFeatures() {
    if (!this.lf) {
      const grace = await this.updateGracePeriod(false);
      return { valid: false, status: 'no_license', features: [] as string[], ...grace };
    }

    const info: LicenseInfoType = this.lf.getLicenseInfo();
    const features = info.features && typeof info.features === 'object' && !Array.isArray(info.features)
      ? Object.keys(info.features)
      : Array.isArray(info.features) ? info.features : [];
    const isActive = info.status === 'active';
    const grace = await this.updateGracePeriod(isActive);
    return { valid: info.valid, status: info.status, features, ...grace };
  }
}

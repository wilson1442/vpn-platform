import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import {
  LICENSE_SERVER_URL,
  LICENSE_PUBLIC_KEY,
  VALIDATE_INTERVAL,
  HEARTBEAT_INTERVAL,
  OFFLINE_GRACE_PERIOD,
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

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    const settings = await this.prisma.appSettings.findUnique({ where: { id: 'singleton' } });
    if (settings?.licenseKey) {
      await this.initialize(settings.licenseKey);
    }
  }

  private async initialize(licenseKey: string) {
    try {
      const { LicenseForge } = await loadSdk();
      this.lf = new LicenseForge({
        serverUrl: LICENSE_SERVER_URL,
        productSlug: 'vpn-pro',
        licenseKey,
        publicKey: LICENSE_PUBLIC_KEY,
        validateInterval: VALIDATE_INTERVAL,
        heartbeatInterval: HEARTBEAT_INTERVAL,
        offlineGracePeriod: OFFLINE_GRACE_PERIOD,
        onValidationFailed: (reason) => {
          this.logger.warn(`License validation failed: ${reason}`);
        },
        onGracePeriod: (daysLeft) => {
          this.logger.warn(`License in grace period: ${daysLeft} days left`);
        },
      });
      await this.lf.initialize();
      this.initError = null;
      this.logger.log('License initialized successfully');
    } catch (err: any) {
      this.initError = err.message || 'Failed to initialize license';
      this.logger.error(`License initialization failed: ${this.initError}`);
      this.lf = null;
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
    }

    if (licenseKey) {
      await this.initialize(licenseKey);
    }

    return this.getStatus();
  }

  isValid(): boolean {
    return this.lf?.isValid() ?? false;
  }

  hasFeature(slug: string): boolean {
    return this.lf?.hasFeature(slug) ?? false;
  }

  getStatus() {
    if (!this.lf) {
      return {
        valid: false,
        status: 'no_license',
        tier: null,
        expiresAt: null,
        features: [] as string[],
        initError: this.initError,
      };
    }

    const info: LicenseInfoType = this.lf.getLicenseInfo();
    return {
      valid: info.valid,
      status: info.status,
      tier: info.tier,
      expiresAt: info.expiresAt,
      features: info.features,
      initError: this.initError,
    };
  }

  getFeatures() {
    if (!this.lf) {
      return { valid: false, status: 'no_license', features: [] as string[] };
    }

    const info: LicenseInfoType = this.lf.getLicenseInfo();
    return { valid: info.valid, status: info.status, features: info.features };
  }
}

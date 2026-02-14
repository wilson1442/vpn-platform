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
  private licenseKey: string | null = null;
  private customerEmail: string | null = null;
  private productSlug: string | null = null;

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
        productSlug: 'vpn-pro',
        licenseKey,
        publicKey: LICENSE_PUBLIC_KEY,
        validateInterval: VALIDATE_INTERVAL,
        heartbeatInterval: HEARTBEAT_INTERVAL,
        offlineGracePeriod: OFFLINE_GRACE_PERIOD,
        onValidationFailed: (reason, details?: unknown) => {
          // Extract meaningful info from SDK error details
          const apiCode = details && typeof details === 'object' && 'code' in details
            ? (details as any).code : null;
          const httpStatus = details && typeof details === 'object' && 'status' in details
            ? (details as any).status : null;

          if (httpStatus === 500 || apiCode === 'INTERNAL_ERROR') {
            validationError = 'License server returned an error. Please verify the product exists on the license server and try again.';
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

      // The SDK catches validation errors internally and doesn't throw.
      // Check if the license is actually valid after initialization.
      if (!this.lf.isValid()) {
        this.initError = validationError || 'License validation failed';
        this.logger.error(`License invalid after init: ${this.initError}`);
      } else {
        this.initError = null;
        this.logger.log('License initialized successfully');
        // Fetch extended info (customer email, etc.) from the server
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
      const resp = await fetch(`${LICENSE_SERVER_URL}/api/v1/license/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey, productSlug: 'vpn-pro' }),
        signal: AbortSignal.timeout(5000),
      });
      if (resp.ok) {
        const json = await resp.json() as { success?: boolean; data?: { customerEmail?: string; product?: string } };
        if (json.success && json.data) {
          this.customerEmail = json.data.customerEmail || null;
          this.productSlug = json.data.product || null;
        }
      }
    } catch {
      // Non-critical — status page will just not show email
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
      this.customerEmail = null;
      this.productSlug = null;
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
        customerEmail: null as string | null,
        product: null as string | null,
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
      customerEmail: this.customerEmail,
      product: this.productSlug,
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

import { SetMetadata } from '@nestjs/common';

export const LICENSE_SERVER_URL = 'https://license-forge.com';

export const LICENSE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAkpEgXDARA8c2xqkYyaOJ
VUCA3XZhGGGXanxcTCa9+l7bzc6mM2d3ATPJDMuh52H0YGLGH/5fWMdTOgVGeaJM
19cU/eTsUuktzoFZR4/OeHiKDcS3dd11Sp54B70rt1AEj4prEK7GxRMAQ/g1M45G
FX5z7zsvfSiE6KstgrwGddCc0yh7bQ/Kfmeo8OVI7MGKgWkeTYn2+E1mXbiFSOVl
b/Kyauu+Rd5qKcRWP9U0/uRMoOF2kHpvzFmpgGWPNhIJYru7j/M9PCVPBfe9ozMk
uwiRYGjTtNFAaNAvInyyyM+ygO6GJEIvqdjG9akf8Gr6XXociivFvo53cANmp8zg
hQIDAQAB
-----END PUBLIC KEY-----`;

export const VALIDATE_INTERVAL = 21600000; // 6 hours
export const HEARTBEAT_INTERVAL = 21600000; // 6 hours
export const OFFLINE_GRACE_PERIOD = 72; // hours
export const PANEL_GRACE_PERIOD_DAYS = 7;

export const TIER_FEATURES: Record<string, string[]> = {
  'vpn-pro': ['resellers'],
  'vpn-provider': [],
};

export const REQUIRE_FEATURE_KEY = 'requireFeature';

export const RequireFeature = (slug: string) => SetMetadata(REQUIRE_FEATURE_KEY, slug);

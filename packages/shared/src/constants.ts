export const Role = {
  ADMIN: 'ADMIN',
  RESELLER: 'RESELLER',
  USER: 'USER',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const LedgerEntryType = {
  ADD: 'ADD',
  DEDUCT: 'DEDUCT',
  REFUND: 'REFUND',
  TRANSFER: 'TRANSFER',
} as const;
export type LedgerEntryType = (typeof LedgerEntryType)[keyof typeof LedgerEntryType];

export const InvoiceStatus = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const KickReason = {
  CONCURRENCY: 'concurrency',
  MANUAL: 'manual',
  CERT_REVOKED: 'cert_revoked',
  ENTITLEMENT_DEACTIVATED: 'entitlement_deactivated',
} as const;
export type KickReason = (typeof KickReason)[keyof typeof KickReason];

export const HEARTBEAT_INTERVAL_MS = 30_000;
export const JWT_ACCESS_EXPIRES = '15m';
export const JWT_REFRESH_EXPIRES = '7d';
export const JWT_REFRESH_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;

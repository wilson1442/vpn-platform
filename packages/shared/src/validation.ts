import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  role: z.enum(['ADMIN', 'RESELLER', 'USER']),
  resellerId: z.string().uuid().optional(),
});

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).max(128).optional(),
  role: z.enum(['ADMIN', 'RESELLER', 'USER']).optional(),
});

export const createResellerSchema = z.object({
  userId: z.string().uuid(),
  companyName: z.string().min(1).max(255),
  parentId: z.string().uuid().optional(),
  maxDepth: z.number().int().min(0).max(10).default(3),
});

export const createVpnNodeSchema = z.object({
  name: z.string().min(1).max(255),
  hostname: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535).default(1194),
  agentPort: z.number().int().min(1).max(65535).default(3001),
  mgmtPort: z.number().int().min(1).max(65535).default(7505),
});

export const createPlanSchema = z.object({
  name: z.string().min(1).max(255),
  maxConnections: z.number().int().min(1).default(1),
  maxDevices: z.number().int().min(1).default(3),
  priceMonthly: z.number().int().min(0),
  resellerId: z.string().uuid().optional(),
});

export const createEntitlementSchema = z.object({
  userId: z.string().uuid(),
  planId: z.string().uuid(),
});

export const createInvoiceSchema = z.object({
  resellerId: z.string().uuid(),
  amountCents: z.number().int().min(1),
});

export const addCreditsSchema = z.object({
  resellerId: z.string().uuid(),
  amount: z.number().int().min(1),
});

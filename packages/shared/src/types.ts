import type { Role } from './constants';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  resellerId?: string;
}

export interface AgentAuthPayload {
  nodeId: string;
}

export interface SessionConnectDto {
  commonName: string;
  realAddress: string;
  vpnNodeId: string;
}

export interface SessionDisconnectDto {
  commonName: string;
  vpnNodeId: string;
  bytesReceived?: number;
  bytesSent?: number;
}

export interface HeartbeatDto {
  crlVersion: number;
  activeConnections: number;
}

export interface KickRequestDto {
  commonName: string;
}

export interface CrlUpdateDto {
  crlPem: string;
  crlVersion: number;
}

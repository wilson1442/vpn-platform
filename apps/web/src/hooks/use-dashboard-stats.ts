'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '@/lib/api';

interface NodeStats {
  nodeId: string;
  nodeName: string;
  hostname: string;
  isActive: boolean;
  lastHeartbeatAt: string | null;
  activeConnections: number;
  cpuPercent: number;
  memPercent: number;
  netRxBps: number;
  netTxBps: number;
  vpnRxBps: number;
  vpnTxBps: number;
}

interface BandwidthPoint {
  time: string;
  rxBps: number;
  txBps: number;
}

interface ServerStats {
  cpuPercent: number;
  memPercent: number;
  netRxBps: number;
  netTxBps: number;
}

export interface DashboardStats {
  onlineUsers: number;
  bandwidthHistory: BandwidthPoint[];
  nodes: NodeStats[];
  server: ServerStats;
}

export function useDashboardStats(intervalMs = 15_000) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const data = await api<DashboardStats>('/stats/dashboard');
      setStats(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch stats');
    }
  }, []);

  useEffect(() => {
    fetchStats();
    timerRef.current = setInterval(fetchStats, intervalMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchStats, intervalMs]);

  return { stats, error };
}

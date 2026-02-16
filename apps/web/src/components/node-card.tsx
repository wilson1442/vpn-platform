'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Gauge } from './gauge';

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

function formatBytes(bps: number): string {
  if (bps >= 1e9) return (bps / 1e9).toFixed(1) + ' GB/s';
  if (bps >= 1e6) return (bps / 1e6).toFixed(1) + ' MB/s';
  if (bps >= 1e3) return (bps / 1e3).toFixed(1) + ' KB/s';
  return bps + ' B/s';
}

function isOnline(lastHeartbeat: string | null): boolean {
  if (!lastHeartbeat) return false;
  return Date.now() - new Date(lastHeartbeat).getTime() < 90_000;
}

function netPercent(rxBps: number, txBps: number): number {
  const totalBps = rxBps + txBps;
  return Math.min(100, Math.round((totalBps / 125_000_000) * 100));
}

export function NodeCard({ node }: { node: NodeStats }) {
  const online = isOnline(node.lastHeartbeatAt);

  return (
    <Card className={online ? '' : 'opacity-40'}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2.5">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              online
                ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30'
                : 'bg-red-500 shadow-lg shadow-red-500/20'
            }`}
          />
          <CardTitle className="text-sm font-semibold">{node.nodeName}</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">{node.hostname}</p>
      </CardHeader>
      <CardContent>
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-md bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-400">
          {node.activeConnections} connection{node.activeConnections !== 1 ? 's' : ''}
        </div>
        <div className="flex justify-around">
          <Gauge value={node.cpuPercent} label="CPU" color="#f59e0b" />
          <Gauge value={node.memPercent} label="RAM" color="#6366f1" />
          <Gauge value={netPercent(node.netRxBps, node.netTxBps)} label="Net" color="#06b6d4" />
        </div>
        <div className="mt-3 flex justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-500" />
            RX: {formatBytes(node.vpnRxBps)}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-500" />
            TX: {formatBytes(node.vpnTxBps)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

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

// Network gauge shows % of 1 Gbps
function netPercent(rxBps: number, txBps: number): number {
  const totalBps = rxBps + txBps;
  return Math.min(100, Math.round((totalBps / 125_000_000) * 100)); // 1 Gbps = 125 MB/s
}

export function NodeCard({ node }: { node: NodeStats }) {
  const online = isOnline(node.lastHeartbeatAt);

  return (
    <Card className={online ? '' : 'opacity-50'}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'}`}
          />
          <CardTitle className="text-sm font-medium">{node.nodeName}</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">{node.hostname}</p>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">
          {node.activeConnections} connection{node.activeConnections !== 1 ? 's' : ''}
        </p>
        <div className="flex justify-around">
          <Gauge value={node.cpuPercent} label="CPU" color="#f59e0b" />
          <Gauge value={node.memPercent} label="RAM" color="#3b82f6" />
          <Gauge value={netPercent(node.netRxBps, node.netTxBps)} label="Net" color="#22c55e" />
        </div>
        <div className="mt-3 flex justify-between text-xs text-muted-foreground">
          <span>RX: {formatBytes(node.vpnRxBps)}</span>
          <span>TX: {formatBytes(node.vpnTxBps)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

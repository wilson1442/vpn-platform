'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface BandwidthPoint {
  time: string;
  rxBps: number;
  txBps: number;
}

function formatBytes(bps: number): string {
  if (bps >= 1e9) return (bps / 1e9).toFixed(1) + ' GB/s';
  if (bps >= 1e6) return (bps / 1e6).toFixed(1) + ' MB/s';
  if (bps >= 1e3) return (bps / 1e3).toFixed(1) + ' KB/s';
  return bps + ' B/s';
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

export function BandwidthChart({ data }: { data: BandwidthPoint[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Aggregate VPN Bandwidth
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="rxGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="txGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
              <XAxis
                dataKey="time"
                tickFormatter={formatTime}
                className="text-xs"
                tick={{ fontSize: 11 }}
              />
              <YAxis tickFormatter={formatBytes} className="text-xs" tick={{ fontSize: 11 }} width={70} />
              <Tooltip
                formatter={(value: any, name: any) => [
                  formatBytes(Number(value)),
                  name === 'rxBps' ? 'Download (RX)' : 'Upload (TX)',
                ]}
                labelFormatter={(label: any) => formatTime(String(label))}
              />
              <Legend formatter={(value) => (value === 'rxBps' ? 'Download (RX)' : 'Upload (TX)')} />
              <Area
                type="monotone"
                dataKey="rxBps"
                stroke="#3b82f6"
                fill="url(#rxGrad)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="txBps"
                stroke="#22c55e"
                fill="url(#txGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

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
    <Card className="overflow-hidden">
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
                  <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="txGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/20" />
              <XAxis
                dataKey="time"
                tickFormatter={formatTime}
                className="text-xs"
                tick={{ fontSize: 11, fill: 'hsl(215 20% 55%)' }}
                stroke="hsl(216 34% 17%)"
              />
              <YAxis
                tickFormatter={formatBytes}
                className="text-xs"
                tick={{ fontSize: 11, fill: 'hsl(215 20% 55%)' }}
                width={70}
                stroke="hsl(216 34% 17%)"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(224 71% 4% / 0.95)',
                  border: '1px solid hsl(216 34% 17%)',
                  borderRadius: '0.75rem',
                  backdropFilter: 'blur(8px)',
                }}
                labelStyle={{ color: 'hsl(215 20% 55%)' }}
                itemStyle={{ color: 'hsl(213 31% 91%)' }}
                formatter={(value: any, name: any) => [
                  formatBytes(Number(value)),
                  name === 'rxBps' ? 'Download (RX)' : 'Upload (TX)',
                ]}
                labelFormatter={(label: any) => formatTime(String(label))}
              />
              <Legend
                formatter={(value) => (value === 'rxBps' ? 'Download (RX)' : 'Upload (TX)')}
                wrapperStyle={{ fontSize: '12px' }}
              />
              <Area
                type="monotone"
                dataKey="rxBps"
                stroke="#2dd4bf"
                fill="url(#rxGrad)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="txBps"
                stroke="#06b6d4"
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

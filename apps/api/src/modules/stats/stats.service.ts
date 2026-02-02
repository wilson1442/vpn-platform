import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as os from 'os';
import * as fs from 'fs';
import { PrismaService } from '../../common/prisma.service';

interface NodeMetrics {
  nodeId: string;
  nodeName: string;
  hostname: string;
  isActive: boolean;
  lastHeartbeatAt: Date | null;
  activeConnections: number;
  cpuPercent: number;
  memPercent: number;
  netRxBps: number;
  netTxBps: number;
  vpnRxBps: number;
  vpnTxBps: number;
  prevTotalBytesRx: number;
  prevTotalBytesTx: number;
  prevTime: number;
}

export interface BandwidthPoint {
  time: string;
  rxBps: number;
  txBps: number;
}

export interface ServerMetrics {
  cpuPercent: number;
  memPercent: number;
  netRxBps: number;
  netTxBps: number;
}

const MAX_HISTORY = 60;
const SERVER_COLLECT_INTERVAL = 15_000;

@Injectable()
export class StatsService implements OnModuleInit, OnModuleDestroy {
  private nodeMetrics = new Map<string, NodeMetrics>();
  private bandwidthHistory: BandwidthPoint[] = [];
  private serverMetrics: ServerMetrics = { cpuPercent: 0, memPercent: 0, netRxBps: 0, netTxBps: 0 };
  private serverTimer: ReturnType<typeof setInterval> | null = null;

  // Server-local metric state
  private prevCpuIdle = 0;
  private prevCpuTotal = 0;
  private prevNetRx = 0;
  private prevNetTx = 0;
  private prevNetTime = 0;

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    // Prime the CPU counters with a first read
    this.collectServerMetrics();
    this.serverTimer = setInterval(() => {
      this.collectServerMetrics();
      this.pushBandwidthPoint();
    }, SERVER_COLLECT_INTERVAL);
  }

  onModuleDestroy() {
    if (this.serverTimer) clearInterval(this.serverTimer);
  }

  private collectServerMetrics() {
    // CPU
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;
    for (const cpu of cpus) {
      idle += cpu.times.idle;
      total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq + cpu.times.idle;
    }
    const idleDelta = idle - this.prevCpuIdle;
    const totalDelta = total - this.prevCpuTotal;
    this.prevCpuIdle = idle;
    this.prevCpuTotal = total;
    const cpuPercent = totalDelta === 0 ? 0 : Math.round((1 - idleDelta / totalDelta) * 100);

    // Memory
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);

    // Network
    const now = Date.now();
    let rx = 0;
    let tx = 0;
    try {
      const content = fs.readFileSync('/proc/net/dev', 'utf-8');
      const lines = content.split('\n').slice(2);
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 10) continue;
        const iface = parts[0].replace(':', '');
        if (iface === 'lo') continue;
        rx += parseInt(parts[1], 10) || 0;
        tx += parseInt(parts[9], 10) || 0;
      }
    } catch {}

    let netRxBps = 0;
    let netTxBps = 0;
    if (this.prevNetTime > 0) {
      const elapsed = (now - this.prevNetTime) / 1000;
      if (elapsed > 0) {
        netRxBps = Math.max(0, Math.round((rx - this.prevNetRx) / elapsed));
        netTxBps = Math.max(0, Math.round((tx - this.prevNetTx) / elapsed));
      }
    }
    this.prevNetRx = rx;
    this.prevNetTx = tx;
    this.prevNetTime = now;

    this.serverMetrics = { cpuPercent, memPercent, netRxBps, netTxBps };
  }

  updateNodeMetrics(
    nodeId: string,
    nodeName: string,
    hostname: string,
    isActive: boolean,
    data: {
      activeConnections?: number;
      cpuPercent?: number;
      memPercent?: number;
      netRxBps?: number;
      netTxBps?: number;
      totalBytesRx?: number;
      totalBytesTx?: number;
    },
  ) {
    const existing = this.nodeMetrics.get(nodeId);
    const now = Date.now();

    let vpnRxBps = 0;
    let vpnTxBps = 0;

    if (
      existing &&
      existing.prevTime > 0 &&
      data.totalBytesRx !== undefined &&
      data.totalBytesTx !== undefined
    ) {
      const elapsed = (now - existing.prevTime) / 1000;
      if (elapsed > 0) {
        const rxDelta = data.totalBytesRx - existing.prevTotalBytesRx;
        const txDelta = data.totalBytesTx - existing.prevTotalBytesTx;
        vpnRxBps = rxDelta > 0 ? Math.round(rxDelta / elapsed) : 0;
        vpnTxBps = txDelta > 0 ? Math.round(txDelta / elapsed) : 0;
      }
    }

    this.nodeMetrics.set(nodeId, {
      nodeId,
      nodeName,
      hostname,
      isActive,
      lastHeartbeatAt: new Date(),
      activeConnections: data.activeConnections ?? 0,
      cpuPercent: data.cpuPercent ?? 0,
      memPercent: data.memPercent ?? 0,
      netRxBps: data.netRxBps ?? 0,
      netTxBps: data.netTxBps ?? 0,
      vpnRxBps,
      vpnTxBps,
      prevTotalBytesRx: data.totalBytesRx ?? 0,
      prevTotalBytesTx: data.totalBytesTx ?? 0,
      prevTime: now,
    });

    this.pushBandwidthPoint();
  }

  private pushBandwidthPoint() {
    // Aggregate system-level network bandwidth across all nodes + server
    let totalRx = this.serverMetrics.netRxBps;
    let totalTx = this.serverMetrics.netTxBps;
    for (const m of this.nodeMetrics.values()) {
      totalRx += m.netRxBps;
      totalTx += m.netTxBps;
    }

    this.bandwidthHistory.push({
      time: new Date().toISOString(),
      rxBps: totalRx,
      txBps: totalTx,
    });

    if (this.bandwidthHistory.length > MAX_HISTORY) {
      this.bandwidthHistory = this.bandwidthHistory.slice(-MAX_HISTORY);
    }
  }

  async getDashboard() {
    const [onlineResult, vpnConnections] = await Promise.all([
      this.prisma.vpnSession.groupBy({
        by: ['userId'],
        where: { disconnectedAt: null },
      }),
      this.prisma.vpnSession.count({
        where: { disconnectedAt: null },
      }),
    ]);
    const onlineUsers = onlineResult.length;

    const nodes = Array.from(this.nodeMetrics.values()).map((m) => ({
      nodeId: m.nodeId,
      nodeName: m.nodeName,
      hostname: m.hostname,
      isActive: m.isActive,
      lastHeartbeatAt: m.lastHeartbeatAt,
      activeConnections: m.activeConnections,
      cpuPercent: m.cpuPercent,
      memPercent: m.memPercent,
      netRxBps: m.netRxBps,
      netTxBps: m.netTxBps,
      vpnRxBps: m.vpnRxBps,
      vpnTxBps: m.vpnTxBps,
    }));

    return {
      onlineUsers,
      vpnConnections,
      bandwidthHistory: this.bandwidthHistory,
      nodes,
      server: this.serverMetrics,
    };
  }
}

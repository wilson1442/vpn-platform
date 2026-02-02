import * as os from 'os';
import * as fs from 'fs';

let prevCpuIdle = 0;
let prevCpuTotal = 0;
let prevNetRx = 0;
let prevNetTx = 0;
let prevNetTime = 0;

function getCpuPercent(): number {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    idle += cpu.times.idle;
    total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq + cpu.times.idle;
  }

  const idleDelta = idle - prevCpuIdle;
  const totalDelta = total - prevCpuTotal;
  prevCpuIdle = idle;
  prevCpuTotal = total;

  if (totalDelta === 0) return 0;
  return Math.round((1 - idleDelta / totalDelta) * 100);
}

function getMemPercent(): number {
  const total = os.totalmem();
  const free = os.freemem();
  return Math.round(((total - free) / total) * 100);
}

function getNetworkBytes(): { rx: number; tx: number } {
  try {
    const content = fs.readFileSync('/proc/net/dev', 'utf-8');
    const lines = content.split('\n').slice(2); // skip header lines
    let rx = 0;
    let tx = 0;
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 10) continue;
      const iface = parts[0].replace(':', '');
      if (iface === 'lo') continue; // skip loopback
      rx += parseInt(parts[1], 10) || 0;
      tx += parseInt(parts[9], 10) || 0;
    }
    return { rx, tx };
  } catch {
    return { rx: 0, tx: 0 };
  }
}

export function collectSystemMetrics(): {
  cpuPercent: number;
  memPercent: number;
  netRxBps: number;
  netTxBps: number;
} {
  const cpuPercent = getCpuPercent();
  const memPercent = getMemPercent();

  const now = Date.now();
  const { rx, tx } = getNetworkBytes();

  let netRxBps = 0;
  let netTxBps = 0;

  if (prevNetTime > 0) {
    const elapsed = (now - prevNetTime) / 1000;
    if (elapsed > 0) {
      netRxBps = Math.round((rx - prevNetRx) / elapsed);
      netTxBps = Math.round((tx - prevNetTx) / elapsed);
      if (netRxBps < 0) netRxBps = 0;
      if (netTxBps < 0) netTxBps = 0;
    }
  }

  prevNetRx = rx;
  prevNetTx = tx;
  prevNetTime = now;

  return { cpuPercent, memPercent, netRxBps, netTxBps };
}

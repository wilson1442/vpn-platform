import { HEARTBEAT_INTERVAL_MS } from '@vpn/shared';
import { getActiveConnectionCount } from './management-interface';
import * as fs from 'fs';

const API_BASE_URL = process.env.AGENT_API_BASE_URL || 'http://localhost:3000';
const AGENT_TOKEN = process.env.AGENT_TOKEN || '';
const CRL_PATH = process.env.CRL_PATH || '/etc/openvpn/crl.pem';

let currentCrlVersion = 0;

export function getCrlVersion() {
  return currentCrlVersion;
}

export function setCrlVersion(version: number) {
  currentCrlVersion = version;
}

export function startHeartbeat() {
  const beat = async () => {
    try {
      const activeConnections = await getActiveConnectionCount();
      const resp = await fetch(`${API_BASE_URL}/vpn-nodes/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${AGENT_TOKEN}`,
        },
        body: JSON.stringify({ crlVersion: currentCrlVersion, activeConnections }),
      });

      if (resp.ok) {
        const data = await resp.json() as any;
        // If server reports newer CRL, pull it
        if (data.crlVersion && data.crlVersion > currentCrlVersion) {
          await pullCrl();
        }
      }
    } catch (err) {
      console.error('Heartbeat error:', err);
    }
  };

  // Initial heartbeat
  beat();
  setInterval(beat, HEARTBEAT_INTERVAL_MS);
}

async function pullCrl() {
  try {
    const resp = await fetch(`${API_BASE_URL}/pki/crl`, {
      headers: { Authorization: `Bearer ${AGENT_TOKEN}` },
    });
    if (resp.ok) {
      const data = await resp.json() as any;
      fs.writeFileSync(CRL_PATH, data.crlPem);
      currentCrlVersion = data.crlVersion;
      console.log(`CRL updated to version ${currentCrlVersion}`);
    }
  } catch (err) {
    console.error('CRL pull error:', err);
  }
}

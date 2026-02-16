import * as net from 'net';

const MGMT_HOST = process.env.MGMT_HOST || '127.0.0.1';
const MGMT_PORT = parseInt(process.env.MGMT_PORT || '7505', 10);

function sendCommand(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let data = '';

    client.connect(MGMT_PORT, MGMT_HOST, () => {
      client.write(command + '\n');
    });

    client.on('data', (chunk) => {
      data += chunk.toString();
      if (data.includes('END') || data.includes('SUCCESS') || data.includes('ERROR')) {
        client.destroy();
        resolve(data);
      }
    });

    client.on('error', reject);
    client.setTimeout(5000, () => {
      client.destroy();
      reject(new Error('Management interface timeout'));
    });
  });
}

export async function getStatus(): Promise<string> {
  return sendCommand('status');
}

export async function killClient(commonName: string): Promise<string> {
  return sendCommand(`kill ${commonName}`);
}

export async function getClientBandwidth(): Promise<
  { commonName: string; realAddress: string; bytesReceived: number; bytesSent: number; connectedSinceEpoch: number }[]
> {
  try {
    const status = await sendCommand('status 2');
    const lines = status.split('\n');
    const clients: { commonName: string; realAddress: string; bytesReceived: number; bytesSent: number; connectedSinceEpoch: number }[] = [];
    for (const line of lines) {
      if (!line.startsWith('CLIENT_LIST\t')) continue;
      const fields = line.split('\t');
      // CLIENT_LIST fields: header, CN, Real Address, Virtual Address, Virtual IPv6,
      //   Bytes Received, Bytes Sent, Connected Since, Connected Since (epoch), Username, ...
      if (fields.length < 8) continue;
      clients.push({
        commonName: fields[1],
        realAddress: fields[2] || 'unknown',
        bytesReceived: parseInt(fields[5], 10) || 0,
        bytesSent: parseInt(fields[6], 10) || 0,
        connectedSinceEpoch: parseInt(fields[8], 10) || 0,
      });
    }
    return clients;
  } catch {
    return [];
  }
}

export async function getActiveConnectionCount(): Promise<number> {
  try {
    const status = await getStatus();
    const lines = status.split('\n');
    let count = 0;
    let inClientList = false;
    for (const line of lines) {
      if (line.startsWith('ROUTING TABLE')) break;
      if (inClientList && line.trim() && !line.startsWith('Common Name')) {
        count++;
      }
      if (line.startsWith('Common Name')) inClientList = true;
    }
    return count;
  } catch {
    return 0;
  }
}

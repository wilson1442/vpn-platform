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

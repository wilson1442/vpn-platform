import { Router } from 'express';

const API_BASE_URL = process.env.AGENT_API_BASE_URL || 'http://localhost:3000';
const AGENT_TOKEN = process.env.AGENT_TOKEN || '';

export const disconnectProxyRoute: Router = Router();

disconnectProxyRoute.post('/', async (req, res) => {
  const { commonName, bytesReceived, bytesSent } = req.body;
  if (!commonName) {
    return res.status(400).json({ error: 'commonName required' });
  }

  try {
    const resp = await fetch(`${API_BASE_URL}/sessions/disconnect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AGENT_TOKEN}`,
      },
      body: JSON.stringify({
        commonName,
        bytesReceived: bytesReceived ?? 0,
        bytesSent: bytesSent ?? 0,
      }),
    });

    const data = await resp.json();
    res.status(resp.status).json(data);
  } catch (err: any) {
    console.error(`Disconnect proxy error for ${commonName}:`, err.message);
    // Don't fail disconnect — best effort
    res.json({ ok: true, warning: 'API unreachable' });
  }
});

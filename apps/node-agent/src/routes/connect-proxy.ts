import { Router } from 'express';

const API_BASE_URL = process.env.AGENT_API_BASE_URL || 'http://localhost:3000';
const AGENT_TOKEN = process.env.AGENT_TOKEN || '';

export const connectProxyRoute: Router = Router();

connectProxyRoute.post('/', async (req, res) => {
  const { commonName, realAddress } = req.body;
  if (!commonName || !realAddress) {
    return res.status(400).json({ error: 'commonName and realAddress required' });
  }

  try {
    const resp = await fetch(`${API_BASE_URL}/sessions/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AGENT_TOKEN}`,
      },
      body: JSON.stringify({ commonName, realAddress }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error(`Connect denied for ${commonName}:`, data);
      return res.status(resp.status).json(data);
    }

    res.json(data);
  } catch (err: any) {
    console.error(`Connect proxy error for ${commonName}:`, err.message);
    res.status(502).json({ error: 'Failed to reach API' });
  }
});

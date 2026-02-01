import { Router } from 'express';

const API_BASE_URL = process.env.AGENT_API_BASE_URL || 'http://localhost:3000';
const AGENT_TOKEN = process.env.AGENT_TOKEN || '';

export const authVerifyRoute: Router = Router();

authVerifyRoute.post('/', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password required' });
  }

  try {
    const resp = await fetch(`${API_BASE_URL}/sessions/vpn-auth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AGENT_TOKEN}`,
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error(`Auth denied for ${username}:`, data);
      return res.status(resp.status).json(data);
    }

    res.json(data);
  } catch (err: any) {
    console.error(`Auth verify error for ${username}:`, err.message);
    res.status(502).json({ error: 'Failed to reach API' });
  }
});

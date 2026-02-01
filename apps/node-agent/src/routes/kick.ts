import { Router } from 'express';
import { killClient } from '../management-interface';

export const kickRoute: Router = Router();

kickRoute.post('/', async (req, res) => {
  const { commonName } = req.body;
  if (!commonName) {
    return res.status(400).json({ error: 'commonName required' });
  }

  try {
    const result = await killClient(commonName);
    res.json({ kicked: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

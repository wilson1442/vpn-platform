import { Router } from 'express';
import { getCrlVersion } from '../heartbeat';

export const healthRoute: Router = Router();

healthRoute.get('/', (_req, res) => {
  res.json({ status: 'ok', crlVersion: getCrlVersion() });
});

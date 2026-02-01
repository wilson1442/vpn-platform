import { Router } from 'express';
import * as fs from 'fs';
import { setCrlVersion } from '../heartbeat';

const CRL_PATH = process.env.CRL_PATH || '/etc/openvpn/crl.pem';

export const crlRoute: Router = Router();

crlRoute.post('/', (req, res) => {
  const { crlPem, crlVersion } = req.body;
  if (!crlPem || !crlVersion) {
    return res.status(400).json({ error: 'crlPem and crlVersion required' });
  }

  try {
    fs.writeFileSync(CRL_PATH, crlPem);
    setCrlVersion(crlVersion);
    res.json({ updated: true, crlVersion });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

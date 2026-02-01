import express from 'express';
import { startHeartbeat } from './heartbeat';
import { healthRoute } from './routes/health';
import { kickRoute } from './routes/kick';
import { crlRoute } from './routes/crl';
import { connectProxyRoute } from './routes/connect-proxy';
import { disconnectProxyRoute } from './routes/disconnect-proxy';
import { authVerifyRoute } from './routes/auth-verify';

const app = express();
app.use(express.json());

const AGENT_TOKEN = process.env.AGENT_TOKEN || '';

// Simple auth middleware
app.use((req, res, next) => {
  if (req.path === '/health') return next();
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${AGENT_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

app.use('/health', healthRoute);
app.use('/kick', kickRoute);
app.use('/crl', crlRoute);
app.use('/connect-proxy', connectProxyRoute);
app.use('/disconnect-proxy', disconnectProxyRoute);
app.use('/auth-verify', authVerifyRoute);

const PORT = parseInt(process.env.AGENT_PORT || '3001', 10);

app.listen(PORT, () => {
  console.log(`Node agent running on port ${PORT}`);
  startHeartbeat();
});

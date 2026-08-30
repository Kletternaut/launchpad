import { Router, Request, Response } from 'express';
import { queryOne } from '../db/index.js';

const router = Router();
const SERVER_VERSION = process.env.LAUNCHPAD_VERSION || '0.1.1.0';
const startedAt = new Date().toISOString();

router.get('/health', (_req: Request, res: Response) => {
  const schema = queryOne<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    ['hierarchy_schema_version'],
  );

  res.json({
    ok: true,
    version: SERVER_VERSION,
    schemaVersion: schema?.value ?? null,
    startedAt,
    node: process.version,
    pid: process.pid,
  });
});

export default router;

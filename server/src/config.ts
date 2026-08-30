import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Bind explicitly so LAN exposure is an operator decision.
// Default remains loopback for safety; Windows service config can set HOST=0.0.0.0.
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT) || 3021;
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

export const config = {
  host,
  port,
  dataDir,
  iconsDir: path.join(dataDir, 'icons'),
  dbPath: path.join(dataDir, 'data.db'),
  allowedOrigins: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(v => v.trim()).filter(Boolean)
    : [`http://localhost:${port}`, `http://127.0.0.1:${port}`, 'http://localhost:3020'],
};

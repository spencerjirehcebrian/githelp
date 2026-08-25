import sqlite3 from 'node:sqlite' || null;
// Alternatively use child_process or raw sqlite commands
import { execSync } from 'child_process';
import { existsSync, unlinkSync } from 'fs';

const dbPath = process.env.DB_PATH || '/tmp/e2e_githelp.db';
if (existsSync(dbPath)) {
  try { unlinkSync(dbPath); } catch {}
}

console.log('Seeding test database at', dbPath);

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadInstallDotenv } from './load-install-env.js';

describe('loadInstallDotenv', () => {
  let tmpDir: string;
  const prev: Record<string, string | undefined> = {};

  beforeEach(() => {
    tmpDir = mkdirSync(path.join(os.tmpdir(), `lan-exam-env-${Date.now()}`), {
      recursive: true,
    });
    for (const key of ['DATABASE_URL', 'SESSION_SECRET', 'WEB_DIST_PATH', 'SKIP_INSTALL_DOTENV']) {
      prev[key] = process.env[key];
      delete process.env[key];
    }
    delete process.env.LAN_EXAM_HOME;
    process.env.SKIP_INSTALL_DOTENV = '0';
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('loads parent .env when cwd is app/', () => {
    const appDir = path.join(tmpDir, 'app');
    mkdirSync(appDir, { recursive: true });
    writeFileSync(
      path.join(tmpDir, '.env'),
      'DATABASE_URL=postgresql://test@127.0.0.1:5434/db\nWEB_DIST_PATH=\n',
      'utf8',
    );

    const prevCwd = process.cwd();
    process.chdir(appDir);
    try {
      loadInstallDotenv();
      expect(process.env.DATABASE_URL).toBe('postgresql://test@127.0.0.1:5434/db');
      expect(process.env.WEB_DIST_PATH).toBe('');
    } finally {
      process.chdir(prevCwd);
    }
  });

  it('strips UTF-8 BOM from .env', () => {
    process.env.LAN_EXAM_HOME = tmpDir;
    writeFileSync(
      path.join(tmpDir, '.env'),
      `\uFEFFSESSION_SECRET=${'x'.repeat(20)}\n`,
      'utf8',
    );

    loadInstallDotenv();
    expect(process.env.SESSION_SECRET).toHaveLength(20);
  });
});

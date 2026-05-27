import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function applyEnvFile(envPath: string): void {
  const raw = stripBom(readFileSync(envPath, 'utf8'));
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    const current = process.env[key];
    if (current === undefined || current === '') {
      process.env[key] = value;
    }
  }
}

/** Load install-root `.env` when packaged (cwd is `app/`, file is one level up). */
export function loadInstallDotenv(): void {
  if (process.env.SKIP_INSTALL_DOTENV === '1') return;

  const candidates: string[] = [];
  const home = process.env.LAN_EXAM_HOME?.trim();
  if (home) {
    candidates.push(path.join(home, '.env'));
  }
  candidates.push(path.resolve(process.cwd(), '..', '.env'));
  candidates.push(path.resolve(process.cwd(), '.env'));

  const seen = new Set<string>();
  for (const envPath of candidates) {
    const resolved = path.resolve(envPath);
    if (seen.has(resolved) || !existsSync(resolved)) continue;
    seen.add(resolved);
    applyEnvFile(resolved);
  }
}

import fs from 'node:fs';
import path from 'node:path';

import { getRepoRoot } from './repo-root.js';

let cached: string | null = null;

function readVersionFile(filePath: string): string | null {
  try {
    const v = fs.readFileSync(filePath, 'utf8').trim();
    return v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

/** Release version for health / admin UI; packaged install reads {LAN_EXAM_HOME}/VERSION. */
export function getAppVersion(): string {
  if (cached) return cached;

  const fromEnv = process.env.LAN_EXAM_VERSION?.trim();
  if (fromEnv) {
    cached = fromEnv;
    return cached;
  }

  const home = process.env.LAN_EXAM_HOME?.trim();
  if (home) {
    const fromHome = readVersionFile(path.join(home, 'VERSION'));
    if (fromHome) {
      cached = fromHome;
      return cached;
    }
  }

  const fromRepo = readVersionFile(path.join(getRepoRoot(), 'VERSION'));
  if (fromRepo) {
    cached = fromRepo;
    return cached;
  }

  cached = 'dev';
  return cached;
}

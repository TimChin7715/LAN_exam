import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Monorepo root (LAN_exam/) from compiled or source server module. */
export function getRepoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../../../..');
}

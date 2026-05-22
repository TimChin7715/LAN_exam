import { join } from 'node:path';

import { getRepoRoot } from './repo-root.js';

export const TEMPLATES_DIR = join(getRepoRoot(), 'templates');

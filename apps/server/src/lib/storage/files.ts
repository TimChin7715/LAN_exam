import fs from 'node:fs/promises';
import path from 'node:path';

import { resolveStoragePath } from './paths.js';

export async function ensureDirForFile(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

export async function writeStorageFile(
  storageKey: string,
  buffer: Buffer,
): Promise<string> {
  const filePath = resolveStoragePath(storageKey);
  await ensureDirForFile(filePath);
  await fs.writeFile(filePath, buffer);
  return storageKey;
}

export async function copyStorageFile(
  fromKey: string,
  toKey: string,
): Promise<string> {
  const fromPath = resolveStoragePath(fromKey);
  const toPath = resolveStoragePath(toKey);
  await ensureDirForFile(toPath);
  await fs.copyFile(fromPath, toPath);
  return toKey;
}

export async function storageFileExists(storageKey: string): Promise<boolean> {
  try {
    await fs.access(resolveStoragePath(storageKey));
    return true;
  } catch {
    return false;
  }
}

export async function readStorageFile(storageKey: string): Promise<Buffer> {
  return fs.readFile(resolveStoragePath(storageKey));
}

export async function deleteStorageTree(storageKeyPrefix: string): Promise<void> {
  const dir = resolveStoragePath(storageKeyPrefix);
  await fs.rm(dir, { recursive: true, force: true });
}

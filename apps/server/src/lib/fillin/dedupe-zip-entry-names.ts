/** 为 ZIP 内条目去重文件名（保留扩展名，重复时加 (2)、(3)…） */
export function dedupeZipEntryNames(fileNames: string[]): string[] {
  const seen = new Map<string, number>();
  return fileNames.map((raw) => {
    const name = raw.replace(/\\/g, '/').split('/').pop()?.trim() || 'file';
    const key = name.toLowerCase();
    const count = seen.get(key) ?? 0;
    seen.set(key, count + 1);
    if (count === 0) return name;
    const dot = name.lastIndexOf('.');
    const suffix = count + 1;
    if (dot > 0) {
      return `${name.slice(0, dot)}(${suffix})${name.slice(dot)}`;
    }
    return `${name}(${suffix})`;
  });
}

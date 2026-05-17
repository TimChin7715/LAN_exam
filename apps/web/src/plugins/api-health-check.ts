import type { Plugin } from 'vite';

/** Warn at dev startup when the API is not reachable (common when only `dev:web` was run). */
export function apiHealthCheckPlugin(apiPort: number): Plugin {
  return {
    name: 'lan-exam-api-health-check',
    configureServer() {
      const url = `http://127.0.0.1:${apiPort}/health`;
      void fetch(url)
        .then((res) => {
          if (!res.ok) {
            printApiWarning(url);
          }
        })
        .catch(() => {
          printApiWarning(url);
        });
    },
  };
}

function printApiWarning(healthUrl: string): void {
  console.warn(
    `\n[lan-exam] 考试 API 未就绪 (${healthUrl})。\n` +
      `  请在本项目根目录运行: pnpm dev\n` +
      `  或另开终端运行: pnpm dev:server\n`,
  );
}

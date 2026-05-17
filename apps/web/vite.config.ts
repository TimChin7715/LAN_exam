import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

import { apiHealthCheckPlugin } from './src/plugins/api-health-check';

const rootDir = path.resolve(__dirname, '../..');

function resolveApiPort(env: Record<string, string>): number {
  const raw = env.API_PORT ?? env.PORT ?? '3101';
  return Number(raw);
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, '');
  const apiPort = resolveApiPort(env);
  const webPort = Number(env.WEB_PORT ?? 5180);

  return {
    envDir: rootDir,
    plugins: [react(), tailwindcss(), apiHealthCheckPlugin(apiPort)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '127.0.0.1',
      port: webPort,
      strictPort: true,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});

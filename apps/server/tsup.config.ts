import { defineConfig } from 'tsup';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  clean: true,
  splitting: false,
  // 将工作区包一并打包，保证 `node dist/index.js` 可直接运行。
  noExternal: [/^@agentcraft\//],
  esbuildOptions(options) {
    options.alias = {
      ...(options.alias ?? {}),
      '@agentcraft/engine': fileURLToPath(new URL('../../packages/engine/src/index.ts', import.meta.url)),
      '@agentcraft/content': fileURLToPath(new URL('../../packages/content/src/index.ts', import.meta.url)),
    };
  },
});

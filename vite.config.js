import { resolve } from 'node:path';

import { defineConfig } from 'vite';
import handlebars from 'vite-plugin-handlebars';

const projectRoot = resolve(import.meta.dirname);

export default defineConfig({
  base: './',
  root: resolve(projectRoot, 'src/pages'),
  plugins: [
    handlebars({
      partialDirectory: resolve(projectRoot, 'src/partials'),
    }),
  ],
  build: {
    assetsInlineLimit: 0,
    emptyOutDir: true,
    outDir: resolve(projectRoot, 'dist'),
    rollupOptions: {
      input: {
        index: resolve(projectRoot, 'src/pages/index.html'),
        catalog: resolve(projectRoot, 'src/pages/catalog.html'),
      },
    },
  },
});

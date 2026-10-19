import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Forge serves Custom UI from a sub-path, so assets must use relative URLs.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'static/viewer', emptyOutDir: true, assetsInlineLimit: 0 },
});

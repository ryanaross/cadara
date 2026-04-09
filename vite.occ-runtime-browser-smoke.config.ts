import path from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  assetsInclude: ['**/*.wasm'],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: '/tmp/occ-runtime-browser-smoke',
    emptyOutDir: true,
    copyPublicDir: false,
    rollupOptions: {
      input: path.resolve(__dirname, './occ-runtime-browser-smoke.html'),
    },
  },
})

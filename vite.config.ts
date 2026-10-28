/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  // rutas relativas: el build funciona en cualquier subcarpeta del hosting
  base: './',
  build: { target: 'es2022', sourcemap: true },
  test: { include: ['tests/**/*.test.ts'] },
});

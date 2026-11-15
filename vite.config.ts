/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  // rutas relativas: el build funciona en cualquier subcarpeta del hosting
  base: './',
  build: {
    target: 'es2022',
    // en la publicación (GitHub Pages) sin mapas de código: no hace falta publicar el código fuente legible
    sourcemap: !process.env.SIN_SOURCEMAPS,
    // dos páginas: la informativa en la raíz y la app en /app/
    rollupOptions: { input: { inicio: resolve(__dirname, 'index.html'), app: resolve(__dirname, 'app/index.html') } },
  },
  test: { include: ['tests/**/*.test.ts'] },
});

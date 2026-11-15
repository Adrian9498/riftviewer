/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  // rutas relativas: el build funciona en cualquier subcarpeta del hosting
  base: './',
  // en la publicación (GitHub Pages) sin mapas de código: no hace falta publicar el código fuente legible
  build: { target: 'es2022', sourcemap: !process.env.SIN_SOURCEMAPS },
  test: { include: ['tests/**/*.test.ts'] },
});

/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';

/** ads.txt para AdSense: se escribe al compilar si está VITE_ADSENSE_CLIENT (ca-pub-…). */
function adsTxt(): Plugin {
  return {
    name: 'ads-txt',
    generateBundle() {
      const env = { ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env };
      const pub = (env.VITE_ADSENSE_CLIENT || '').trim().replace(/^ca-/, '');
      if (/^pub-\d{10,20}$/.test(pub)) this.emitFile({ type: 'asset', fileName: 'ads.txt', source: `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n` });
    },
  };
}

export default defineConfig({
  plugins: [adsTxt()],
  // rutas relativas: el build funciona en cualquier subcarpeta del hosting
  base: './',
  build: {
    target: 'es2022',
    // en la publicación (GitHub Pages) sin mapas de código: no hace falta publicar el código fuente legible
    sourcemap: !process.env.SIN_SOURCEMAPS,
    // tres páginas: la informativa en la raíz, la app en /app/ y la carpeta pública en /carpeta/
    rollupOptions: { input: { inicio: resolve(__dirname, 'index.html'), app: resolve(__dirname, 'app/index.html'), carpeta: resolve(__dirname, 'carpeta/index.html') } },
  },
  test: { include: ['tests/**/*.test.ts'] },
});

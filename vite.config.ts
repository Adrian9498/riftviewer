/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { buildGuidePage, pageGuide } from './src/guides/page';
import { GUIDES } from './src/guides/index';

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

/** Código de verificación de AdSense en la landing (lo que Google revisa para aprobar el sitio). */
function adsVerify(): Plugin {
  return {
    name: 'ads-verify',
    transformIndexHtml(html, ctx) {
      const env = { ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env };
      const client = (env.VITE_ADSENSE_CLIENT || '').trim();
      const landing = resolve(ctx.filename) === resolve(__dirname, 'index.html');
      if (!/^ca-pub-\d{10,20}$/.test(client) || !landing) return html;
      return html.replace('</head>', `<meta name="google-adsense-account" content="${client}">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}" crossorigin="anonymous"></script>
</head>`);
    },
  };
}

/** Guías (guides/…): la página sale ya escrita en inglés y en español, con los datos de src/guides. */
function guidePages(): Plugin {
  return {
    name: 'guide-pages',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const g = pageGuide(ctx.filename);
        return g === undefined ? html : buildGuidePage(html, g, __dirname);
      },
    },
  };
}

export default defineConfig({
  plugins: [guidePages(), adsTxt(), adsVerify()],
  // rutas relativas: el build funciona en cualquier subcarpeta del hosting
  base: './',
  build: {
    target: 'es2022',
    // en la publicación (GitHub Pages) sin mapas de código: no hace falta publicar el código fuente legible
    sourcemap: !process.env.SIN_SOURCEMAPS,
    // la informativa en la raíz, la app en /app/, la carpeta pública en /carpeta/ y las guías en /guides/
    rollupOptions: {
      input: {
        inicio: resolve(__dirname, 'index.html'), app: resolve(__dirname, 'app/index.html'), carpeta: resolve(__dirname, 'carpeta/index.html'),
        guias: resolve(__dirname, 'guides/index.html'),
        ...Object.fromEntries(GUIDES.map(g => ['guia-' + g.slug, resolve(__dirname, `guides/${g.slug}/index.html`)])),
      },
    },
  },
  test: { include: ['tests/**/*.test.ts'] },
});

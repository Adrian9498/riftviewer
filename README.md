# Visualizador de partidas de Riftbound

Convierte replays de RiftAtlas (`.json`) y guiones escritos a mano (`.txt`) en partidas animadas, listas para grabar o exportar como video.

## Requisitos
- Node.js 22 o superior

## Uso
```bash
npm install          # una vez
npm run catalogo     # descarga el catálogo de OpenRift (repetir cuando salga un set nuevo)
npm run dev          # servidor de desarrollo en http://localhost:5173
```

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga automática |
| `npm run build` | Revisa tipos y genera la versión publicable en `dist/` |
| `npm run preview` | Sirve `dist/` para revisarla |
| `npm test` | Pruebas automáticas (Vitest) |
| `npm run typecheck` | Solo revisión de tipos |
| `npm run catalogo` | Actualiza `public/openrift-catalog.json` (también: doble clic en `actualizar-openrift.cmd`) |

El build es un sitio estático: se puede publicar en cualquier hosting. Ya no se abre con doble clic sobre un archivo; necesita servirse por http (`npm run dev` / `npm run preview`).

## Estructura
```
index.html              marcado de la app
src/main.ts             punto de entrada: llama al init() de cada módulo de src/app en orden
src/styles/app.css      estilos

src/data/               (TS estricto) nombres de cartas, catálogo de OpenRift
src/script/             (TS estricto) lenguaje de guiones: parser
src/replay/             (TS estricto) decodificación de replays, traducción del registro, mazos,
                        encuadre de la cámara, detección de batallas y puntos

src/app/                la interfaz y el render (JavaScript, se irá tipando)
  state.ts              estado compartido entre módulos (app.playing, app.speed, app.token, app.R, app.PCOL)
  base.js utils.js fit.js           utilidades, escala del escenario
  cards.js custom-images.js         carga de cartas (riftcodex + OpenRift), imágenes propias
  demo.js script-engine.js          guion de ejemplo y mesa del modo guion
  replay.js layout-lanes.js replay-render.js   replays: carga, distribuciones, render y cámara
  export.js clips.js notes.js       exportar video, clips, notas y "adivina la jugada"
  chart.js summary.js               gráfica de puntos y resumen final
  brand.js sounds.js hover.js       marca, sonidos, vista ampliada
  shell.js ui.js                    inicio, recientes, pestañas, barra superior, atajos

tests/                  pruebas unitarias + prueba de humo de la app completa (jsdom)
scripts/                utilidades (descarga del catálogo)
visualizador.html       versión anterior en un solo archivo (referencia; se borra al confirmar que todo funciona igual)
```

Reglas de los módulos de `src/app`: a nivel superior solo hay declaraciones (exportadas); todo lo que tiene efectos (eventos, preferencias, carga inicial) va en `init()`. Así no importa el orden en que se evalúan los módulos que se importan entre sí.

## Datos y créditos
Datos de cartas: riftcodex y [OpenRift](https://openrift.app). Imágenes y textos de cartas © Riot Games.

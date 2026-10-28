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
src/main.ts             punto de entrada
src/styles/app.css      estilos
src/legacy/app.js       la app (en migración: se va dividiendo en los módulos de abajo)
src/data/               cartas: normalización de nombres, catálogo de OpenRift
src/script/             lenguaje de guiones (parser)
src/replay/             replays de RiftAtlas: decodificación, traducción del registro, mazos
tests/                  pruebas de los módulos
scripts/                utilidades (descarga del catálogo)
visualizador.html       versión anterior en un solo archivo (referencia, se eliminará)
```

## Datos y créditos
Datos de cartas: riftcodex y [OpenRift](https://openrift.app). Imágenes y textos de cartas © Riot Games.

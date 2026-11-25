# Guías de especialista

Una guía por leyenda en `riftviewer.com/guides/<leyenda>/`, más el índice en `/guides/` (las leyendas sin guía salen como "Coming soon").

## Cómo se arma

- Los datos de cada guía viven en `src/guides/data/<leyenda>.ts` (tipos en `src/guides/types.ts`): tablas de core, flex, banquillo y campos, una lista de ejemplo, el texto en inglés y en español, y las listas usadas como fuente.
- Al compilar, el plugin `guide-pages` de `vite.config.ts` cambia la plantilla `<!--guide-page-->` de cada página por el documento completo (`src/guides/page.ts` y `render.ts`). Cada idioma tiene su dirección: `/guides/<slug>/` en inglés y `/es/guides/<slug>/` en español, enlazadas con hreflang, con su propio título para buscadores (`seoTitle`), Open Graph con la carta de la leyenda y datos estructurados (Article, BreadcrumbList). Quien eligió español y entra a la inglesa va a la suya.
- En el texto, `[[Nombre de carta]]` se vuelve un nombre con vista previa de la carta. Los nombres y códigos salen de `public/openrift-catalog.json`.
- Una sección con `draft: true` muestra la marca "Pending specialist review" hasta que alguien que juega la leyenda la revise.

## Método para los datos

1. Listas de RiftDecks de la leyenda, con fecha desde el corte que se elija (en Diana: después del ban de Stacked Deck, 18 sep 2026), sin cartas baneadas hoy y de torneos con 64 jugadores o más.
2. Solo las de buen resultado: top 8, o dentro del 10% mejor.
3. Las tablas usan las del formato actual. **Core** = en al menos 90% de esas listas; **flex** = lo común que cambia; el banquillo dice contra qué entra cada carta (sale del texto de la carta).
4. La estrategia se explica a partir del texto de las cartas; el mulligan y los matchups los revisa un especialista.

## Liberar una leyenda nueva

1. `src/guides/data/<slug>.ts` con su `Guide`.
2. Agregarla a `GUIDES` en `src/guides/index.ts`.
3. Copiar `guides/diana/index.html` a `guides/<slug>/index.html` y a `es/guides/<slug>/index.html` (son iguales para todas), y agregar las dos direcciones a `public/sitemap.xml` con sus `xhtml:link` (las pruebas lo revisan).
4. Agregar `https://riftviewer.com/guides/<slug>/` a `public/sitemap.xml`.

`tests/guides.test.ts` revisa que existan todas las cartas, que la lista de ejemplo tenga 40 + 12 runas + 3 campos, que el enlace al constructor abra esa lista y que la guía esté en el sitemap.

## Jugadas animadas

- Cada guía puede tener `plays`: guiones del visualizador (comandos en inglés, textos en cada idioma), por ejemplo `src/guides/data/diana-plays.ts`. La primera fase de cada guion solo acomoda la mesa.
- En la guía sale un botón "Watch the play"; al pulsarlo se carga la app incrustada en `app/?embed=1#play=<guion en base64url>`.
- El modo incrustado (`src/app/embed.js`, `embed-flag.js`) muestra solo el tablero y la barra de reproducción: sin pantalla de acceso de la beta, sin recorrido de bienvenida y sin guardar en recientes. Funciona sin cuenta.
- Las pruebas revisan que cada guion se lea sin errores, que sus cartas existan y que la versión en inglés y en español hagan las mismas jugadas.

# SEO de riftviewer.com

## Lo que ya tiene la página

- **Título y descripción** con las búsquedas clave (Riftbound, replays, mazos, colección, escáner, precios).
- **Dirección canónica** (`https://riftviewer.com/`) para que Google no reparta la página entre variantes.
- **Vista previa al compartir** (Open Graph y Twitter): imagen de 1200×630 (`public/og-image.png`), título y descripción.
- **Ícono** en el navegador, en iPhone y Android, y **manifiesto** (`/manifest.webmanifest`): la app se puede instalar desde el teléfono.
- **Datos estructurados** (JSON-LD): el sitio, la aplicación (gratis, web, categoría juegos) y las **preguntas frecuentes**, que también se ven en la página.
- **`robots.txt`** y **`sitemap.xml`**: se indexa la página informativa; la app (`/app/`, beta cerrada) no.
- **Página 404** propia.

Las imágenes se rehacen con `node scripts/iconos.mjs` si cambia el diseño.

## Pasos que te tocan (una sola vez)

### 1. Google Search Console (lo más importante)

1. Entra a <https://search.google.com/search-console> y agrega una propiedad de tipo **Dominio**: `riftviewer.com`.
2. Google te da un registro **TXT**. En Hostinger → DNS de riftviewer.com → agrega un registro TXT en `@` con ese valor.
3. Vuelve a Search Console y pulsa **Verificar** (puede tardar unos minutos).
4. En **Sitemaps**, envía `https://riftviewer.com/sitemap.xml`.
5. En **Inspección de URLs**, pega `https://riftviewer.com/` y pulsa **Solicitar indexación**.

### 2. Bing Webmaster Tools

En <https://www.bing.com/webmasters> puedes **importar el sitio desde Search Console** con un clic. Bing también alimenta a DuckDuckGo y a otros buscadores.

### 3. Revisar la vista previa al compartir

- Facebook / WhatsApp: <https://developers.facebook.com/tools/debug/> → pega la dirección → *Volver a extraer*.
- Discord y X toman la imagen solos; si muestran una vieja, agrega `?v=2` al enlace la primera vez.

## Recomendaciones para crecer

1. **Enlaces desde la comunidad** (lo que más pesa): un post en r/Riftbound y en los Discord de Riftbound en español
   mostrando un video hecho con Riftviewer; el enlace en la descripción de tus videos de YouTube y en tus redes.
2. **Contenido que la gente busca**: páginas propias con guías ("cómo grabar tus partidas de Riftbound",
   "cuánto vale el set Radiance", "mejores mazos de…"). Cada guía es una entrada nueva en Google; se agregan al sitemap.
3. **Página del set con precios**: una página pública por set con las cartas más caras y su historial
   (ya tenemos los datos diarios). Es contenido que se actualiza solo y que la gente busca seguido.
4. **Versión en inglés** (más adelante): la comunidad de Riftbound es mayormente en inglés. Con una página `/en/` y
   las etiquetas `hreflang`, Google muestra cada idioma a quien corresponde.
5. **Medir**: Search Console dice con qué búsquedas apareces; para visitas, una herramienta sin cookies
   (como Plausible o Cloudflare Web Analytics) no necesita aviso de cookies.
6. **Mazos compartidos indexables** (más adelante): hoy los mazos compartidos viven dentro de la app (`#deck=…`) y
   Google no los ve. Una página pública por mazo compartido atraería búsquedas de listas.

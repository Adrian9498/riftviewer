# Publicar en GitHub Pages

La app se publica sola en **https://riftviewer.com** cada vez que cambia `main`
(dominio propio; `https://adrian9498.github.io/riftviewer/` redirige ahí).
Lo hace el flujo [`.github/workflows/pages.yml`](../.github/workflows/pages.yml): instala dependencias,
descarga el catálogo de cartas y calcula las huellas del arte (`npm run catalogo`), corre las pruebas,
compila y publica `dist/`. Si una prueba falla, no se publica nada y la versión anterior sigue en línea.

## Una sola vez

### 1. Activar Pages

GitHub → el repo → **Settings → Pages** → *Build and deployment* → **Source: GitHub Actions**.

> En una cuenta gratuita, GitHub Pages solo funciona con repos **públicos**.
> Con el repo privado hace falta GitHub Pro (o Team / Enterprise).
> Aunque el repo sea privado, **la página publicada siempre es pública**.

### 2. Variables de Supabase y Patreon

GitHub → **Settings → Secrets and variables → Actions → pestaña Variables → New repository variable**:

| Nombre | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | el mismo de tu `.env.local` |
| `VITE_SUPABASE_ANON_KEY` | el mismo de tu `.env.local` (la clave pública, *anon* / *publishable*) |
| `VITE_PATREON_URL` | tu página de Patreon (opcional) |

Van como **Variables**, no como *Secrets*, porque son públicas: terminan dentro de la página.
**Nunca** pongas aquí la clave `service_role`, el secreto de Patreon ni la clave de Riot.

### 3. Supabase: permitir la dirección nueva

Supabase → tu proyecto → **Authentication → URL Configuration**:

- **Site URL**: `https://riftviewer.com`
- **Redirect URLs**: agrega `https://riftviewer.com/**` y `https://www.riftviewer.com/**`
  (deja también `http://localhost:5173/**` para seguir probando en tu PC).

Sin esto, los correos de confirmación y el inicio de sesión con Google o Discord regresan a la dirección vieja.

### 4. Patreon: permitir la dirección nueva

En `supabase/.env.patreon`, agrega la dirección a `APP_URLS` (separadas por coma) y súbelo otra vez:

```
APP_URLS=http://localhost:5173,https://riftviewer.com,https://www.riftviewer.com
```

```
npx supabase secrets set --env-file supabase/.env.patreon
```

## Dominio propio (riftviewer.com)

Configurado en GitHub → **Settings → Pages → Custom domain**. Con un flujo de GitHub Actions no hace falta el archivo `CNAME` en el repo.

En el DNS del proveedor del dominio:

| Tipo | Nombre | Valor |
| --- | --- | --- |
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `adrian9498.github.io` |

**Ningún otro registro A** en `@` (los proveedores suelen dejar uno propio de "página en construcción":
hay que borrarlo). Cuando GitHub muestre *DNS check successful*, emite el certificado y se puede marcar
**Enforce HTTPS**. Sin HTTPS no funciona la cámara del escáner.

## Publicar

- Automático: cada `git push` a `main`.
- A mano: GitHub → **Actions → Publicar en GitHub Pages → Run workflow**.

El avance y los errores se ven en la pestaña **Actions**. La primera vez tarda unos 2 o 3 minutos.

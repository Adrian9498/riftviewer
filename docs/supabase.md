# Configurar Supabase (cuentas y nube)

Sin esta configuración la app funciona igual, solo en local (no aparece el botón **👤 Entrar**).

## 1. Crear el proyecto
1. Entra a [supabase.com](https://supabase.com) → **New project**. Elige una región cercana a tus usuarios (por ejemplo `East US` o `South America (São Paulo)`) y guarda la contraseña de la base de datos en tu gestor de contraseñas.
2. En **Project Settings → API** copia la **Project URL** y la **anon public key**.
3. En la raíz del repo crea `.env.local` (ya está en `.gitignore`) a partir de `.env.example`:
   ```
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   ```
   La *anon key* es pública (va en el navegador; la seguridad la dan las políticas RLS). **Nunca** pongas la *service_role key* en el frontend ni en el repo.

## 2. Crear las tablas
Elige una opción:

**A. Con la CLI (recomendado: deja la base versionada con el repo)**
```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push
```
`<ref>` es la parte de la URL antes de `.supabase.co`. `db push` aplica todo lo que haya en `supabase/migrations/`.

**B. A mano:** abre **SQL Editor**, pega el contenido de `supabase/migrations/20261027120000_cuentas_y_sincronizacion.sql` y ejecútalo.

Crea: `profiles`, `user_settings`, `documents`, `projects`, `user_assets`, `entitlements` (todas con RLS: cada usuario solo ve lo suyo), el trigger que crea perfil + plan gratis al registrarse, y los buckets privados `replays` y `user-assets`.

## 3. URLs de regreso
**Authentication → URL Configuration**
- **Site URL:** `http://localhost:5173` (cuando publiques, tu dominio).
- **Redirect URLs:** agrega `http://localhost:5173/**` y `http://localhost:4173/**` (y luego `https://tu-dominio/**`).

Son las direcciones a las que Supabase devuelve al usuario después de confirmar su correo, recuperar contraseña o entrar con Google/Discord.

## 4. Correo y contraseña
Viene activado. Por defecto pide confirmar el correo. El servidor de correo de Supabase solo manda unos pocos correos por hora: para producción configura un SMTP propio en **Authentication → Emails → SMTP Settings** (por ejemplo Resend, Postmark o Amazon SES). En **Email Templates** puedes traducir los correos al español.

## 5. Google
1. [Google Cloud Console](https://console.cloud.google.com) → crea un proyecto → **APIs & Services → OAuth consent screen** (tipo *External*, nombre de la app, tu correo).
2. **Credentials → Create credentials → OAuth client ID** → *Web application*.
3. En **Authorized redirect URIs** agrega: `https://<ref>.supabase.co/auth/v1/callback`
4. Copia **Client ID** y **Client secret** en Supabase → **Authentication → Sign In / Providers → Google** y actívalo.

## 6. Discord
1. [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. **OAuth2 → Redirects** → agrega `https://<ref>.supabase.co/auth/v1/callback`.
3. Copia **Client ID** y **Client Secret** (Reset Secret) en Supabase → **Authentication → Sign In / Providers → Discord** y actívalo.

## 7. Probar
Reinicia `npm run dev` (Vite lee `.env.local` al arrancar). Aparece **👤 Entrar** arriba a la derecha.

## Qué se sincroniza
| Dato | Dónde |
|---|---|
| Marca, sonidos, distribución, cámara, formato | `user_settings` |
| Clips y notas de cada partida | `projects` |
| Los 8 recientes | `documents` (guiones en la tabla; replays en el bucket `replays`) |
| Imágenes de cartas, logo, fondo, audios propios | `user_assets` + bucket `user-assets` |
| Plan (gratis / premium) | `entitlements` (solo lo escribe el servidor; fase 3) |

Regla de conflictos: por elemento, gana el cambio más reciente. Los borrados se propagan con "lápidas" (`deleted = true`).

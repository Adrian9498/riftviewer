# Conectar Patreon

Quien apoya en Patreon conecta su cuenta desde **Tu cuenta → Conectar con Patreon** y su plan se actualiza solo:
al conectar y cada vez que Patreon avisa un cambio (alta, cambio de nivel, cobro, cancelación).

```
App ──(sesión)──▶ patreon-connect ──▶ Patreon (autorizar) ──▶ patreon-callback ──▶ entitlements
Patreon ──(webhook firmado)──▶ patreon-webhook ──▶ entitlements
```
Las claves de Patreon viven como secretos en Supabase. No se guardan tokens de Patreon.

Tu proyecto: `yubdphyswoviehwvuiaj` → las funciones quedan en `https://yubdphyswoviehwvuiaj.supabase.co/functions/v1/…`

## 1. Niveles en Patreon
En tu página de creador define los niveles (nombre, precio y qué incluye). Cada nivel se asigna a un **plan** de la app
(por ejemplo `apoyo` y `pro`); la fase 4 decide qué desbloquea cada plan.

## 2. Cliente OAuth
[Portal de desarrolladores → Clients & API Keys](https://www.patreon.com/portal/registration/register-clients) → **Create Client**:
- **App Name / Description:** Riftviewer (lo ven tus patrones al conectar).
- **Redirect URIs:** `https://yubdphyswoviehwvuiaj.supabase.co/functions/v1/patreon-callback`
- **Client API Version:** 2

Guarda el **Client ID**, el **Client Secret** y el **Creator's Access Token** (este último solo para el paso 3).

## 3. Id de la campaña y de los niveles
Con el *Creator's Access Token*:
```bash
curl -H "Authorization: Bearer TU_CREATOR_TOKEN" "https://www.patreon.com/api/oauth2/v2/campaigns?include=tiers&fields%5Btier%5D=title,amount_cents"
```
- `data[0].id` → **PATREON_CAMPAIGN_ID**
- cada elemento de `included` con `"type":"tier"` → su `id` y su `title` (para **PATREON_TIERS**)

## 4. Webhook
[Portal → Webhooks](https://www.patreon.com/portal/registration/register-webhooks) → URL:
`https://yubdphyswoviehwvuiaj.supabase.co/functions/v1/patreon-webhook`
Activa: `members:create`, `members:update`, `members:delete`, `members:pledge:create`, `members:pledge:update`, `members:pledge:delete`.
Guarda el **secreto** del webhook.

## 5. Base de datos
Aplica `supabase/migrations/20261028120000_patreon.sql` (SQL Editor, igual que la primera migración, o `npx supabase db push`).

## 6. Secretos y despliegue (CLI, una sola vez)
```bash
npx supabase login
npx supabase link --project-ref yubdphyswoviehwvuiaj
```
Copia `supabase/patreon.env.example` como `supabase/.env.patreon`, llénalo y súbelo:
```bash
npx supabase secrets set --env-file supabase/.env.patreon
```
Despliega las funciones:
```bash
npx supabase functions deploy patreon-connect
npx supabase functions deploy patreon-callback --no-verify-jwt
npx supabase functions deploy patreon-webhook --no-verify-jwt
```
Cuando publiques la app, agrega su dirección a `APP_URLS` y vuelve a ejecutar `secrets set`.

## 7. Probar
Inicia sesión en la app → **Tu cuenta → Conectar con Patreon** → autoriza → vuelves a la app con un aviso y tu plan.
Como creador no puedes apoyar tu propia campaña: prueba con otra cuenta de Patreon.
Los registros de las funciones están en Supabase → **Edge Functions → (función) → Logs**.

| Resultado en la app | Significa |
|---|---|
| "Patreon conectado" y plan distinto de Gratis | Todo bien |
| Conectado pero plan Gratis | Esa cuenta no tiene un nivel activo que esté en `PATREON_TIERS` |
| "Esa cuenta de Patreon ya está vinculada a otro usuario" | Una cuenta de Patreon solo puede usarse en un usuario |
| "Patreon no respondió…" | Revisa los Logs de `patreon-callback` (suele ser Client ID/Secret o la Redirect URI) |

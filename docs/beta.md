# Beta cerrada

Con la beta **cerrada**, la app (`riftviewer.com/app/`) pide iniciar sesión y solo deja pasar a los correos
de la lista de invitados. Solo esos correos pueden crear cuenta, también con Google o Discord: lo revisa la
base de datos, así que no se puede saltar desde la página. La página informativa (`riftviewer.com`) siempre
está abierta.

Con la beta **abierta**, la app funciona como antes: sin pedir cuenta.

## Comandos

Todo se hace en Supabase → **SQL Editor** (o en **Table Editor**, tablas `beta_config` y `beta_invitados`).

| Para… | SQL |
| --- | --- |
| Cerrar la beta | `update public.beta_config set cerrada = true;` |
| Abrirla a todos | `update public.beta_config set cerrada = false;` |
| Encender Patreon (Full Access) | `update public.beta_config set patreon = true;` |
| Apagar Patreon (todo desbloqueado) | `update public.beta_config set patreon = false;` |
| Invitar a alguien | `insert into public.beta_invitados (email) values ('alguien@correo.com');` |
| Invitar a varios | `insert into public.beta_invitados (email) values ('a@correo.com'), ('b@correo.com');` |
| Con una nota | `insert into public.beta_invitados (email, nota) values ('a@correo.com', 'Discord: Ana');` |
| Quitar una invitación | `delete from public.beta_invitados where email = 'alguien@correo.com';` |
| Ver la lista | `select * from public.beta_invitados order by created_at;` |
| Contar invitados | `select count(*) from public.beta_invitados;` |

Los correos van **en minúsculas** (la tabla lo exige).

## Patreon

Mientras **Patreon está apagado** (así nace, para la beta Friends & Family), todos tienen todo desbloqueado
y la app no muestra nada de Patreon: sin candados, sin marca de agua, sin la ventana de Full Access y sin
"Conectar con Patreon" en Tu cuenta (el plan aparece como **Beta · todo incluido**).
Al encenderlo vuelve todo como antes: plan Gratis / Full Access y la conexión con Patreon.
El cambio llega a cada usuario la próxima vez que abra la app (o al iniciar sesión).

## Notas

- **Agrégate tú primero**: las cuentas que ya existían también necesitan invitación para entrar.
- Quitar a alguien de la lista le cierra el acceso la próxima vez que abra la app (su cuenta y sus datos se quedan).
- Si alguien sin invitación intenta registrarse, ve "Riftviewer está en beta cerrada y ese correo no tiene invitación".
- La pantalla de acceso es la puerta de la interfaz; la protección real son el candado del registro y que cada
  usuario solo puede leer sus propios datos.
- Instalación: las migraciones `20261116120000_beta_cerrada.sql` y `20261116130000_interruptor_patreon.sql`
  (`npx supabase db push`). Nacen con la beta **cerrada** y Patreon **apagado**.

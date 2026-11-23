# Carpeta pública

Cada cuenta puede publicar su colección como una carpeta de 9 cartas por hoja que cualquiera hojea con un enlace
(`riftviewer.com/carpeta/#<slug>`), sin cuenta y aunque la beta esté cerrada.

- **Publicar:** Colección → **Carpeta pública**. Se elige el nombre y si van todas las cartas o solo las especiales
  (alternas, firmadas, foil/metal y épicas). Es una foto: para que se vea lo nuevo, **Actualizar con mi colección de hoy**.
- **Quitar:** en la misma ventana, **Dejar de publicar** (el enlace deja de funcionar).
- **Datos:** tabla `public_binders` (una fila por cuenta). Cualquiera la lee; solo el dueño la crea, cambia o borra.
- **Instalación:** aplica `supabase/migrations/20261123120000_carpeta_publica.sql`
  (`npx supabase db push`, o pégala en **SQL Editor**).

# Idiomas

Riftviewer es **en inglés por defecto**, con opción de **español**. El selector EN / ES está en:

- la barra de la landing y de la carpeta pública,
- el menú de secciones de la app (◆ Riftviewer ▾ → Language),
- la pantalla de acceso,
- la página de privacidad.

La elección se guarda en el navegador (`rb_lang`) y cambiar de idioma recarga la página.

## Cómo funciona

- El código y el HTML están escritos en **español**; ese texto es la clave.
- `src/i18n/en.ts` es el diccionario español → inglés. `{0}`, `{1}`… son huecos para valores.
- `src/i18n/dom.ts` traduce la página al vuelo cuando el idioma es inglés: cada texto, `title`,
  `placeholder` o `aria-label` que coincide con una frase del diccionario (completa o con huecos) se cambia.
  También entiende frases unidas con " · ". No toca lo que escribe la persona (cajas de texto, nombres
  marcados con `translate="no"`).
- Lo que no pasa por la página (avisos `alert`/`confirm`, textos para copiar, nombres por defecto, mensajes
  armados con `<b>` en medio) usa `t()` / `_t()` de `src/i18n/i18n.ts`.
- Los textos puestos con `content:` en el CSS tienen su versión en inglés en `src/i18n/i18n.css`.
- El registro de jugadas del replay queda en inglés (como lo escribe el simulador) cuando la app está en inglés.
- Los guiones aceptan los comandos en inglés y en español (`play p1 "Card" to base` = `juega j1 "Carta" a base`).

## Agregar un texto nuevo

1. Escríbelo en español en el código o el HTML, como siempre.
2. Agrega su traducción en `src/i18n/en.ts` (la clave exacta, sin espacios de sobra).
3. Si lleva valores, usa huecos: `'Versión {0}': "Version {0}"`.
4. Si el texto mezcla etiquetas (`¿Borrar <b>{0}</b>?`), pásalo por `_t()` en el código con el HTML completo.

La prueba `tests/i18n.test.ts` revisa que cada traducción use los mismos huecos que su original.

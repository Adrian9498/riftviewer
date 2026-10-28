/** Normaliza un nombre para compararlo: minúsculas, sin acentos y solo letras/números separados por un espacio. */
export const norm = (s: string | null | undefined): string =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

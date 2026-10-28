// Capítulos para la descripción de YouTube a partir de los momentos marcados al grabar.
// YouTube pide: el primero en 0:00, al menos 3 capítulos y cada uno de 10 segundos o más.

export interface ChapterMark { t: number; label: string }   // t en segundos desde el inicio del video

export const fmtTime = (s: number): string => {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

/** Limpia las marcas: quita repetidas, junta las de menos de minGap segundos y pone la primera en 0:00. */
export function cleanChapters(marks: ChapterMark[], duration: number, minGap = 10): ChapterMark[] {
  const seq = [...marks].sort((a, b) => a.t - b.t).filter((m, k, a) => m.label && (k === 0 || m.label !== a[k - 1].label));
  const out: ChapterMark[] = [];
  seq.forEach((m, k) => {
    const end = k + 1 < seq.length ? seq[k + 1].t : duration;
    if (end - m.t >= minGap || k === seq.length - 1) out.push({ ...m });
  });
  // la última pudo quedar corta: se une a la anterior
  if (out.length > 1 && duration - out[out.length - 1].t < minGap) out.pop();
  if (out.length) out[0].t = 0;
  return out.filter((m, k, a) => k === 0 || m.label !== a[k - 1].label);
}

export const chaptersText = (cs: ChapterMark[]): string => cs.map(c => `${fmtTime(c.t)} ${c.label}`).join('\n');

// Decisión de sincronización "gana el cambio más reciente" (sin red ni DOM, para poder probarla).

export interface Versioned {
  key: string;
  /** milisegundos desde 1970 del último cambio */
  ts: number;
  /** lápida: el elemento se borró en este lado */
  deleted?: boolean;
}

export interface SyncPlan<L extends Versioned, R extends Versioned> {
  /** subir a la nube (local más nuevo o solo existe en local) */
  push: L[];
  /** bajar de la nube (remoto más nuevo o solo existe en la nube) */
  pull: R[];
  /** borrar en local (en la nube hay una lápida más nueva) */
  removeLocal: R[];
}

/**
 * Compara ambos lados por clave. Las lápidas viajan como cualquier cambio: si el borrado es lo más
 * reciente, gana. Una lápida remota de algo que no existe en local no hace nada.
 * `limitPull` deja bajar solo los N elementos remotos más recientes que falten en local.
 */
export function planSync<L extends Versioned, R extends Versioned>(local: L[], remote: R[], limitPull = Infinity): SyncPlan<L, R> {
  const plan: SyncPlan<L, R> = { push: [], pull: [], removeLocal: [] };
  const rem = new Map(remote.map(r => [r.key, r]));
  const loc = new Map(local.map(l => [l.key, l]));
  for (const l of local) {
    const r = rem.get(l.key);
    if (!r || l.ts > r.ts) plan.push.push(l);
  }
  const missing: R[] = [];
  for (const r of remote) {
    const l = loc.get(r.key);
    if (l && l.ts >= r.ts) continue;
    if (r.deleted) { if (l && !l.deleted) plan.removeLocal.push(r); continue; }
    if (!l) missing.push(r); else plan.pull.push(r);
  }
  missing.sort((a, b) => b.ts - a.ts);
  plan.pull.push(...missing.slice(0, limitPull));
  return plan;
}

/** Fecha ISO de Supabase → milisegundos. */
export const toMs = (iso: string | null | undefined): number => (iso ? Date.parse(iso) || 0 : 0);
/** Milisegundos → fecha ISO para guardar en Supabase. */
export const toIso = (ms: number): string => new Date(ms || Date.now()).toISOString();

/** Nombre de archivo seguro para Storage a partir de una clave arbitraria (con un hash para que no choquen). */
export function storageName(key: string): string {
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h * 33) ^ key.charCodeAt(i)) >>> 0;
  return key.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 160) + '-' + h.toString(36);
}

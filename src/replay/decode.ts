// Los replays de RiftAtlas guardan un grafo de objetos deduplicado:
//   nodes[i] = ["o", [[clave, valor], ...]]   (objeto)
//            | ["a", [valor, ...]]            (lista)
// y cualquier valor {"r": n} es una referencia a nodes[n]. Así se comparten
// los estados que no cambian entre jugadas.

export type RawNode = ['o', [string, unknown][]] | ['a', unknown[]];

export interface RawReplay {
  format: string;
  version?: number;
  nodes: RawNode[];
  root: { r: number };
}

const isRef = (v: unknown): v is { r: number } =>
  !!v && typeof v === 'object' && !Array.isArray(v) && 'r' in v && Object.keys(v).length === 1;

/** Reconstruye el objeto raíz del replay, resolviendo referencias (y ciclos) a nodos compartidos. */
export function decodeReplay<T = any>(j: RawReplay): T {
  if (!j || j.format !== 'riftatlas-replay' || !Array.isArray(j.nodes)) throw new Error('El archivo no es un replay de RiftAtlas');
  const memo = new Map<number, unknown>();
  const D = (v: unknown): unknown => (Array.isArray(v) ? v.map(D) : isRef(v) ? N(v.r) : v);
  function N(i: number): unknown {
    if (memo.has(i)) return memo.get(i);
    const node = j.nodes[i];
    if (!node) throw new Error(`Referencia rota en el replay (nodo ${i})`);
    const [kind, value] = node;
    if (kind === 'o') {
      const o: Record<string, unknown> = {};
      memo.set(i, o);
      for (const [k, v] of value as [string, unknown][]) o[k] = D(v);
      return o;
    }
    const a: unknown[] = [];
    memo.set(i, a);
    for (const x of value as unknown[]) a.push(D(x));
    return a;
  }
  return N(j.root.r) as T;
}

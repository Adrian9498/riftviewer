// Cálculo del encuadre de la "cámara que sigue la acción" (sin DOM).

export interface Rect { x: number; y: number; w: number; h: number }
export type CameraMode = 'suave' | 'intensa' | 'off';
export interface CameraView { s: number; tx: number; ty: number }

export const FULL_VIEW: CameraView = { s: 1, tx: 0, ty: 0 };

/** Rectángulo que contiene a todos. */
export function union(rs: Rect[]): Rect {
  const x = Math.min(...rs.map(r => r.x)), y = Math.min(...rs.map(r => r.y));
  return { x, y, w: Math.max(...rs.map(r => r.x + r.w)) - x, h: Math.max(...rs.map(r => r.y + r.h)) - y };
}

/** Agranda un objetivo muy pequeño (centrado) para que la cámara no se acerque de más y quede contexto. */
export function padTarget(t: Rect, area: Rect): Rect {
  const w = Math.max(t.w + 60, area.w * 0.36), h = Math.max(t.h + 60, area.h * 0.32);
  return { x: t.x + t.w / 2 - w / 2, y: t.y + t.h / 2 - h / 2, w, h };
}

const LIMITS: Record<Exclude<CameraMode, 'off'>, { fill: number; max: number }> = {
  suave: { fill: 0.86, max: 1.6 },
  intensa: { fill: 0.94, max: 2.4 },
};

/**
 * Escala y desplazamiento para centrar `t` dentro del área visible `area` sin salirse del contenido
 * (que ocupa exactamente `area`). Sin objetivo, o con un acercamiento casi nulo, devuelve la vista completa.
 */
export function computeCamera(t: Rect | null | undefined, area: Rect, mode: CameraMode): CameraView {
  if (!t || mode === 'off' || t.w <= 0 || t.h <= 0) return { ...FULL_VIEW };
  const { fill, max } = LIMITS[mode];
  const s = Math.max(1, Math.min(max, Math.min(area.w / t.w, area.h / t.h) * fill));
  if (s < 1.03) return { ...FULL_VIEW };
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const tx = clamp(area.w / 2 - (t.x + t.w / 2) * s, area.w - area.w * s, 0);
  const ty = clamp(area.h / 2 - (t.y + t.h / 2) * s, area.h - area.h * s, 0);
  return { s, tx, ty };
}

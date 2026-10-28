// Plan del usuario (Gratis / Full Access) y qué funciones incluye.
// Se guarda en caché para que funcione sin conexión hasta su fecha de vencimiento.
import { currentUser } from './auth';
import { supabase } from './client';

export type Feature = 'export_hd' | 'no_watermark' | 'export_presets' | 'brand_full' | 'notes_advanced';

/** Lo que desbloquea Full Access (en el orden en que se muestra). */
export const FEATURES: Record<Feature, string> = {
  export_hd: 'Videos a la resolución completa de tu pantalla y a 60 fps (Gratis: 720p · 30 fps)',
  no_watermark: 'Videos sin marca de agua',
  export_presets: 'Todos tus clips en un solo video, cada uno con su título',
  brand_full: 'Tu marca completa: logo, fondo propio, pantalla verde y tamaño y alineación de la mesa',
  notes_advanced: 'Notas avanzadas: flechas, resaltar cartas, "Adivina la jugada" y gráfica de puntos',
};

export interface PlanState { tier: string; validUntil: number | null; userId: string | null }

const CACHE = 'rb_plan';
const FREE: PlanState = { tier: 'free', validUntil: null, userId: null };
let plan: PlanState = FREE;
const listeners = new Set<(p: PlanState) => void>();

/** ¿El plan sigue vigente para este usuario en este momento? */
export function isActive(p: PlanState, userId: string | null, now = Date.now()): boolean {
  if (p.tier === 'free' || !userId || p.userId !== userId) return false;
  return p.validUntil == null || p.validUntil > now;
}

export const currentPlan = (): PlanState => plan;
export const isPremium = (): boolean => isActive(plan, currentUser()?.id ?? null);
export const hasFeature = (_f: Feature): boolean => isPremium();   // hoy Full Access incluye todo

export function onPlanChange(fn: (p: PlanState) => void): () => void {
  listeners.add(fn); fn(plan);
  return () => listeners.delete(fn);
}
function setPlan(p: PlanState) {
  plan = p;
  try { localStorage.setItem(CACHE, JSON.stringify(p)); } catch { /* sin almacenamiento */ }
  for (const fn of listeners) fn(plan);
}

/** Carga el plan guardado (sirve sin conexión) y luego lo confirma con la nube. */
export async function refreshPlan(): Promise<PlanState> {
  const user = currentUser();
  if (!user) { setPlan(FREE); return plan; }
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE) || 'null') as PlanState | null;
    if (cached && cached.userId === user.id && plan.userId !== user.id) { plan = cached; for (const fn of listeners) fn(plan); }
  } catch { /* caché dañada: se ignora */ }
  const sb = supabase();
  if (!sb) return plan;
  const { data, error } = await sb.from('entitlements').select('tier, valid_until').maybeSingle();
  if (error) return plan;   // sin conexión: se queda el plan en caché hasta que venza
  setPlan({ tier: data?.tier || 'free', validUntil: data?.valid_until ? Date.parse(data.valid_until) : null, userId: user.id });
  return plan;
}

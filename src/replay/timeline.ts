// Clasificación de cada jugada del replay para la línea de tiempo: qué icono lleva y si es importante.
// Las "menores" (pagos, runas, robar, pasar foco…) se pueden ocultar con "Solo lo importante".

export type ActionKind =
  | 'play' | 'move' | 'spell' | 'resolve' | 'conquer' | 'score' | 'combat' | 'draw' | 'rune' | 'trash'
  | 'token' | 'might' | 'exhaust' | 'target' | 'xp' | 'turn' | 'setup' | 'equip' | 'other';

export interface Kind { kind: ActionKind; major: boolean }

const MINOR = new Set<ActionKind>(['draw', 'rune', 'exhaust', 'other', 'resolve']);

export function actionKind(actionType?: string | null, text?: string | null): Kind {
  const a = actionType || '', t = text || '';
  const k = ((): ActionKind => {
    if (/conquered/i.test(t)) return 'conquer';
    if (a === 'set_score' || /scored? \d+ point|score/i.test(a)) return 'score';
    if (a.startsWith('battlefield_conquer')) return 'combat';
    if (a === 'move_card') return /\bplayed\b/i.test(t) ? 'play' : 'move';
    if (a === 'chain_add') return 'spell';
    if (a === 'chain_resolve' || a === 'chain_set_resolve_vote') return 'resolve';
    if (a === 'draw_cards') return 'draw';
    if (a === 'payment_batch' || a === 'rune_batch' || a === 'adjust_floating_resource') return 'rune';
    if (a === 'move_cards_to_trash_batch' || a === 'send_to_deck') return 'trash';
    if (a === 'create_token') return 'token';
    if (a === 'equip_card') return 'equip';
    if (a === 'adjust_card_counter' || a === 'clear_card_counter' || a === 'adjust_card_might') return 'might';
    if (a === 'toggle_exhausted') return 'exhaust';
    if (a === 'target_arrow_add') return 'target';
    if (a === 'adjust_legend_xp') return 'xp';
    if (a === 'end_turn') return 'turn';
    if (/mulligan|initiative|first_player|select_battlefield|game_start|sideboard/.test(a)) return 'setup';
    return 'other';
  })();
  // pasar el foco de un combate no aporta nada a la narración
  const major = !MINOR.has(k) && !(k === 'combat' && /pass|dismiss|optional/.test(a));
  return { kind: k, major };
}

/** Icono del set de index.html para cada tipo. */
export const KIND_ICON: Record<ActionKind, string> = {
  play: 'i-play', move: 'i-move', spell: 'i-sparkle', resolve: 'i-check', conquer: 'i-flag', score: 'i-crown',
  combat: 's-might', draw: 'i-cards', rune: 's-rune', trash: 'i-x', token: 'i-plus', might: 's-might',
  exhaust: 's-exhaust', target: 'i-target', xp: 'i-star', turn: 'i-arrow', setup: 'i-sliders', equip: 'i-shield', other: 'i-dot',
};

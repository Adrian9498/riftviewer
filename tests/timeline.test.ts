import { describe, expect, it } from 'vitest';
import { actionKind } from '../src/replay/timeline';

describe('actionKind', () => {
  it('distingue jugar de mover', () => {
    expect(actionKind('move_card', 'Killjoyz played Hwei from hand to base.')).toEqual({ kind: 'play', major: true });
    expect(actionKind('move_card', 'Vavy moved Azir from base to Emperor\'s Dais.')).toEqual({ kind: 'move', major: true });
  });

  it('la conquista gana aunque venga de una confirmación de combate', () => {
    expect(actionKind('battlefield_conquer_confirm', 'Killjoyz conquered Packed Amphitheater and scored 1 point.').kind).toBe('conquer');
    expect(actionKind('battlefield_conquer_confirm', 'Showdown at Dusk Rose Lab').kind).toBe('combat');
  });

  it('marca como menores los pagos, el robo y pasar el foco', () => {
    expect(actionKind('payment_batch', '').major).toBe(false);
    expect(actionKind('draw_cards', 'Vavy drew 1 card.').major).toBe(false);
    expect(actionKind('battlefield_conquer_pass_focus', '').major).toBe(false);
  });

  it('agrupa la preparación y lo desconocido', () => {
    expect(actionKind('submit_mulligan').kind).toBe('setup');
    expect(actionKind('algo_nuevo')).toEqual({ kind: 'other', major: false });
    expect(actionKind(null, null).kind).toBe('other');
  });
});

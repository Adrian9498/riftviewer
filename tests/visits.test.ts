// @vitest-environment jsdom
// Contador de visitas: sin código no carga nada; con código, el script de GoatCounter una sola vez.
import { describe, expect, it } from 'vitest';
import { goatCode, startVisits } from '../src/stats/visits';

describe('contador de visitas', () => {
  it('acepta el código o la dirección completa, y rechaza lo demás', () => {
    expect(goatCode('riftviewer')).toBe('riftviewer');
    expect(goatCode(' https://RiftViewer.goatcounter.com/count ')).toBe('riftviewer');
    expect(goatCode('')).toBe('');
    expect(goatCode('mal código"><script>')).toBe('');
  });

  it('sin código o en localhost no carga nada', () => {
    expect(startVisits('', 'riftviewer.com')).toBe(false);
    expect(startVisits('riftviewer', 'localhost')).toBe(false);
    expect(document.querySelector('script[src*="gc.zgo.at"]')).toBeNull();
  });

  it('con código carga el script una vez, apuntando a tu panel', () => {
    expect(startVisits('riftviewer', 'riftviewer.com')).toBe(true);
    expect(startVisits('riftviewer', 'riftviewer.com')).toBe(false);
    const s = document.querySelectorAll<HTMLScriptElement>('script[src*="gc.zgo.at"]');
    expect(s).toHaveLength(1);
    expect(s[0].dataset.goatcounter).toBe('https://riftviewer.goatcounter.com/count');
  });
});

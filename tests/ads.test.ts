// @vitest-environment jsdom
// Anuncios: sin configurar no se carga nada; configurados, un bloque adaptable por espacio y el script una sola vez.
import { describe, expect, it } from 'vitest';
import { adsEnabled, mountAd, mountAds } from '../src/ads/ads';

const C = 'ca-pub-1234567890123456', S = '9876543210';

describe('anuncios', () => {
  it('solo con un id de editor y de bloque válidos', () => {
    expect(adsEnabled('', '')).toBe(false);
    expect(adsEnabled(C, '')).toBe(false);
    expect(adsEnabled('pub-123', S)).toBe(false);
    expect(adsEnabled(C, S)).toBe(true);
  });

  it('sin configurar: los espacios quedan ocultos y no se carga Google', () => {
    document.body.innerHTML = '<div class="adbox" hidden></div>';
    mountAds();
    expect((document.querySelector('.adbox') as HTMLElement).hidden).toBe(true);
    expect(document.querySelector('script[src*="googlesyndication"]')).toBeNull();
  });

  it('configurado: pone el bloque, lo marca como publicidad y carga el script una vez', () => {
    document.body.innerHTML = '<div class="adbox" id="a" hidden></div><div class="adbox" id="b" hidden></div><div hidden><div class="adbox" id="c" hidden></div></div>';
    const a = document.getElementById('a')!, b = document.getElementById('b')!;
    expect(mountAd(a, C, S)).toBe(true);
    expect(mountAd(a, C, S)).toBe(false);          // una vez por espacio
    expect(mountAd(b, C, S)).toBe(true);
    expect(a.hidden).toBe(false);
    expect(a.querySelector('.adlbl')!.textContent).toBe('Publicidad');
    const ins = a.querySelector('ins.adsbygoogle') as HTMLElement;
    expect(ins.dataset.adClient).toBe(C);
    expect(ins.dataset.adSlot).toBe(S);
    expect(document.querySelectorAll('script[src*="googlesyndication"]')).toHaveLength(1);
    expect((window as any).adsbygoogle).toHaveLength(2);
  });
});

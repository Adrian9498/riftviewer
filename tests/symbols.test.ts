import { describe, expect, it } from 'vitest';
import { cardTextHTML, symbolHTML } from '../src/data/symbols';

describe('símbolos del texto de cartas', () => {
  it('cambia los códigos por iconos', () => {
    expect(symbolHTML('rb_might')).toContain('#s-might');
    expect(symbolHTML('rb_energy_2')).toContain('>2</span>');
    expect(symbolHTML('rb_rune_fury')).toContain('sm-fury');
    expect(symbolHTML('rb_desconocido')).toBeNull();
  });

  it('usa el texto rich con sus párrafos y listas', () => {
    const h = cardTextHTML('<p>Do it:</p><ul><li>Unit — Give me +3 :rb_might: this turn.</li></ul>', 'ignorado');
    expect(h).toMatch(/^<p>Do it:<\/p><ul><li>Unit — Give me \+3 <span class="sym sm-might"/);
  });

  it('no deja pasar etiquetas ni atributos peligrosos', () => {
    const h = cardTextHTML('<p onclick="x()">Hola</p><img src=x onerror=alert(1)><script>bad()</script>');
    expect(h).not.toMatch(/<(img|script)|<p [^>]*>/);          // ninguna etiqueta real con atributos
    expect(h).toContain('&lt;script&gt;');
    expect(h).toContain('&lt;p onclick=&quot;x()&quot;&gt;');  // queda como texto inofensivo
  });

  it('sin rich usa el texto plano, escapado', () => {
    expect(cardTextHTML(null, 'A < B :rb_exhaust:\nC')).toBe('A &lt; B <span class="sym sm-exhaust" title="Agotar"><svg><use href="#s-exhaust"/></svg></span><br>C');
    expect(cardTextHTML(null, 'Pay :rb_raro_x:')).toBe('Pay raro x');
  });

  it('las entidades que ya trae riftcodex no se escapan dos veces (Undying Legion)', () => {
    const rich = cardTextHTML('<p>[Legion][&gt;] You may play me from your trash.</p>');
    expect(rich).toBe('<p>[Legion][&gt;] You may play me from your trash.</p>');
    expect(cardTextHTML(null, '[Legion][&gt;] Tom &amp; Jerry &#39;x&#39;')).toBe('[Legion][&gt;] Tom &amp; Jerry \'x\'');
    // una etiqueta escrita con entidades sigue siendo texto, nunca HTML
    expect(cardTextHTML('<p>&lt;img src=x onerror=alert(1)&gt;</p>')).toBe('<p>&lt;img src=x onerror=alert(1)&gt;</p>');
  });
});

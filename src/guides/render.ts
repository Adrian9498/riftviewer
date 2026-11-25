// Dibuja una guía como HTML (se usa al compilar: la página sale ya escrita, en inglés y en español).
import { encodeDeck } from '../deck/format';
import type { Deck } from '../deck/model';
import type { Guide, GuideCard, GuideSection, Lang } from './types';

export interface GuideCardInfo { name: string; code: string; img: string; type: string }
export type CardFinder = (name: string) => GuideCardInfo | undefined;

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const UI = {
  en: {
    since: (n: number, d: string, why: string) => `Built from ${n} tournament lists with good results played after ${why} (${d}).`,
    updated: 'Updated', core: 'Core', coreSub: 'In almost every list. Start here.', flex: 'Flex slots',
    flexSub: 'Common choices that change with the meta.', side: 'Sideboard', bfs: 'Battlefields', runes: 'Runes',
    inLists: (k: number, n: number) => `in ${k} of ${n} lists`, copies: (c: string) => `×${c}`,
    sample: 'Sample list', open: 'Open in the deck builder', source: 'See it on RiftDecks', main: 'Main deck',
    sideboard: 'Sideboard', draft: 'Pending specialist review', sources: 'Lists used',
    sourcesSub: (m: string, n: number) => `The tables use the ${n} ${m} lists (the current format). Placements are from RiftDecks.`,
    all: (s: string) => `All ${s} lists on RiftDecks`, back: 'All guides', toc: 'In this guide', vs: 'Why',
  },
  es: {
    since: (n: number, d: string, why: string) => `Hecha con ${n} listas de torneo con buen resultado jugadas después de ${why} (${d}).`,
    updated: 'Actualizada', core: 'Core', coreSub: 'Va en casi todas las listas. Empieza aquí.', flex: 'Huecos flexibles',
    flexSub: 'Opciones comunes que cambian con el meta.', side: 'Banquillo', bfs: 'Campos de batalla', runes: 'Runas',
    inLists: (k: number, n: number) => `en ${k} de ${n} listas`, copies: (c: string) => `×${c}`,
    sample: 'Lista de ejemplo', open: 'Abrir en el constructor', source: 'Verla en RiftDecks', main: 'Mazo principal',
    sideboard: 'Banquillo', draft: 'Pendiente de revisión de un especialista', sources: 'Listas usadas',
    sourcesSub: (m: string, n: number) => `Las tablas usan las ${n} listas de ${m} (el formato actual). Los lugares son de RiftDecks.`,
    all: (s: string) => `Todas las listas de ${s} en RiftDecks`, back: 'Todas las guías', toc: 'En esta guía', vs: 'Para qué',
  },
};

const fmtDate = (d: string, lang: Lang) =>
  new Date(d + 'T12:00:00Z').toLocaleDateString(lang === 'en' ? 'en-US' : 'es', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

/** [[Carta]] → nombre con vista previa; el resto se deja como está (el texto de la guía es nuestro, no del usuario). */
export function inline(s: string, find: CardFinder): string {
  return s.replace(/\[\[([^\]]+)\]\]/g, (_, name: string) => {
    const c = find(name);
    return c ? `<span class="gcard" tabindex="0" data-img="${esc(c.img)}">${esc(c.name)}</span>` : `<b>${esc(name)}</b>`;
  });
}

function tile(c: GuideCard, n: number, lang: Lang, find: CardFinder, why = false): string {
  const info = find(c.name);
  const u = UI[lang];
  const pct = Math.round((c.lists / n) * 100);
  return `<li class="gtile">
    <figure>${info ? `<img src="${esc(info.img)}" alt="${esc(info.name)}" loading="lazy" decoding="async" width="200" height="279">` : ''}
      <span class="gcopies">${esc(u.copies(c.copies))}</span></figure>
    <div class="gtxt"><b>${esc(info?.name || c.name)}</b>
      <span class="gbar" style="--p:${pct}%"><i></i></span><small>${esc(u.inLists(c.lists, n))}</small>
      ${why && c.why ? `<p class="gwhy">${esc(c.why[lang])}</p>` : ''}</div>
  </li>`;
}

const grid = (cards: GuideCard[], n: number, lang: Lang, find: CardFinder, why = false) =>
  `<ul class="ggrid">${cards.map(c => tile(c, n, lang, find, why)).join('')}</ul>`;

function section(s: GuideSection, lang: Lang, find: CardFinder, extra = ''): string {
  return `<section class="gsec" id="${esc(s.id)}">
    <h2>${esc(s.h)}${s.draft ? ` <span class="gdraft">${esc(UI[lang].draft)}</span>` : ''}</h2>
    ${s.p.map(p => `<p>${inline(p, find)}</p>`).join('')}
    ${s.list ? `<ul class="glist">${s.list.map(x => `<li>${inline(x, find)}</li>`).join('')}</ul>` : ''}
    ${extra}
  </section>`;
}

/** El mazo de ejemplo como enlace del constructor (#deck=…), con los códigos de cada carta. */
export function sampleDeck(g: Guide, find: CardFinder): Deck {
  const code = (name: string) => {
    const c = find(name);
    if (!c) throw new Error(`Guía ${g.slug}: no encuentro la carta "${name}"`);
    return c.code;
  };
  const rec = (r: Record<string, number>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [code(k), v]));
  return {
    id: 'guide-' + g.slug, name: `${g.short} · Riftviewer guide`, legend: code(g.legend), champion: code(g.champion),
    main: rec(g.sample.main), runes: rec(g.sample.runes), battlefields: g.sample.battlefields.map(code), side: rec(g.sample.side), updatedAt: 0,
  };
}

function deckList(r: Record<string, number>, find: CardFinder) {
  const rows = Object.entries(r).map(([name, n]) => ({ n, c: find(name), name }));
  const order = ['unit', 'gear', 'spell', 'rune', 'battlefield'];
  rows.sort((a, b) => order.indexOf(a.c?.type || '') - order.indexOf(b.c?.type || '') || a.name.localeCompare(b.name));
  return `<ul class="gdeck">${rows.map(x => `<li><span>${x.n}</span> ${inline(`[[${x.name}]]`, find)}</li>`).join('')}</ul>`;
}

/** El artículo completo de una guía en un idioma. */
export function renderGuide(g: Guide, lang: Lang, find: CardFinder, appBase = '../../app/'): string {
  const u = UI[lang];
  const n = g.studied.main;
  const S = Object.fromEntries(g.sections[lang].map(s => [s.id, s]));
  const deck = sampleDeck(g, find);
  const champ = find(g.champion), legend = find(g.legend);
  const sample = `<div class="gsample">
      <h3>${esc(u.sample)}</h3><p class="gmuted">${esc(g.sample.label[lang])}</p>
      <div class="gcols">
        <div><h4>${esc(u.main)}</h4>${deckList({ [g.champion]: 1, ...g.sample.main }, find)}</div>
        <div><h4>${esc(u.bfs)}</h4>${deckList(Object.fromEntries(g.sample.battlefields.map(b => [b, 1])), find)}
          <h4>${esc(u.runes)}</h4>${deckList(g.sample.runes, find)}
          <h4>${esc(u.sideboard)}</h4>${deckList(g.sample.side, find)}</div>
      </div>
      <p class="gactions"><a class="gbtn gold" href="${esc(appBase)}#deck=${encodeDeck(deck)}">${esc(u.open)}</a>
        <a class="gbtn" href="${esc(g.sample.source)}" target="_blank" rel="noopener">${esc(u.source)}</a></p>
    </div>`;
  const toc = g.sections[lang].map(s => `<a href="#${esc(s.id)}">${esc(s.h)}</a>`);
  toc.splice(1, 0, `<a href="#lists">${esc(u.core)}</a>`);
  return `<article class="guide" lang="${lang}">
  <header class="ghead">
    <div class="gart">${legend ? `<img src="${esc(legend.img)}" alt="${esc(legend.name)}" width="200" height="279">` : ''}${champ ? `<img src="${esc(champ.img)}" alt="${esc(champ.name)}" width="200" height="279">` : ''}</div>
    <div>
      <p class="gkicker"><a href="../">${esc(u.back)}</a> · ${esc(g.domains.join(' / '))}</p>
      <h1>${esc(g.title[lang])}</h1>
      <p class="glead">${esc(g.intro[lang])}</p>
      <p class="gmuted">${esc(u.since(g.studied.total, fmtDate(g.since, lang), g.sinceWhy[lang]))} ${esc(u.updated)}: ${esc(fmtDate(g.updated, lang))}.</p>
    </div>
  </header>
  <nav class="gtoc" aria-label="${esc(u.toc)}">${toc.join('')}</nav>
  ${section(S.engine, lang, find)}
  <section class="gsec" id="lists">
    <h2>${esc(u.core)}</h2><p class="gmuted">${esc(u.coreSub)}</p>${grid(g.core, n, lang, find)}
    <h3>${esc(u.flex)}</h3><p class="gmuted">${esc(u.flexSub)}</p>${grid(g.flex, n, lang, find)}
    <h3>${esc(u.bfs)}</h3>${grid(g.battlefields, n, lang, find)}
    <h3>${esc(u.runes)}</h3><p>${esc(g.runes[lang])}</p>
    ${sample}
  </section>
  ${section(S.core, lang, find)}
  ${section(S.plan, lang, find)}
  ${section(S.mulligan, lang, find)}
  ${section(S.side, lang, find, grid(g.side, n, lang, find, true))}
  ${section(S.ban, lang, find)}
  <div class="adbox" hidden></div>
  <section class="gsec gsources" id="sources">
    <h2>${esc(u.sources)}</h2><p class="gmuted">${esc(u.sourcesSub(g.studied.mainMeta, n))}</p>
    <ol>${g.sources.map(s => `<li><b>${esc(s.place)}</b> / ${s.players.toLocaleString('en-US')} · ${esc(s.event)} · ${esc(s.player)} · ${esc(s.date)} · ${esc(s.meta)}</li>`).join('')}</ol>
    <p><a href="${esc(g.sourcesUrl)}" target="_blank" rel="noopener">${esc(u.all(g.short))}</a></p>
  </section>
</article>`;
}

/** El índice de guías: las que ya salieron y las que vienen. */
export function renderIndex(guides: Guide[], legends: { name: string; champ: string; domains: string[] }[], lang: Lang, find: CardFinder): string {
  const done = new Map(guides.map(g => [g.short, g]));
  const soon = lang === 'en' ? 'Coming soon' : 'Próximamente';
  const tiles = legends.map(l => {
    const g = done.get(l.champ);
    const img = find(l.name)?.img;
    const inner = `${img ? `<img src="${esc(img)}" alt="${esc(l.name)}" loading="lazy" decoding="async" width="200" height="279">` : ''}
      <b>${esc(l.champ)}</b><small>${esc(l.name)}</small>${g ? '' : `<span class="gsoon">${esc(soon)}</span>`}`;
    return g ? `<li class="glegend on"><a href="${esc(g.slug)}/">${inner}</a></li>` : `<li class="glegend">${inner}</li>`;
  });
  // las que ya tienen guía, primero
  tiles.sort((a, b) => Number(b.includes(' on"')) - Number(a.includes(' on"')));
  const t = lang === 'en'
    ? { h: 'Legend specialist guides', p: 'Decks change every week, but every legend has a core. Each guide is built from real tournament lists and explains how the deck wins. A new legend every so often.' }
    : { h: 'Guías de especialista por leyenda', p: 'Los mazos cambian cada semana, pero cada leyenda tiene un core. Cada guía sale de listas reales de torneo y explica cómo gana el mazo. Una leyenda nueva cada cierto tiempo.' };
  return `<article class="guide" lang="${lang}"><header class="gindex"><h1>${esc(t.h)}</h1><p class="glead">${esc(t.p)}</p></header>
  <ul class="glegends">${tiles.join('')}</ul></article>`;
}

// Guía de Diana, Scorn of the Moon.
// Datos: 20 listas con buen resultado (top 8, o top 10% en torneos de 64+ jugadores) jugadas después del ban
// de Stacked Deck (18 sep 2026), leídas de RiftDecks el 24 nov 2026: 11 de Radiance y 9 de Vendetta.
// Las tablas de core, flex y banquillo salen de las 11 de Radiance (el formato actual).
// Ninguna de esas listas usa cartas del ban del 23 nov 2026.
import type { Guide } from '../types';

export const DIANA: Guide = {
  slug: 'diana',
  legend: 'Scorn of the Moon',
  champion: 'Diana, Lunari',
  short: 'Diana',
  domains: ['Mind', 'Chaos'],
  updated: '2026-11-24',
  since: '2026-09-18',
  sinceWhy: {
    en: 'the Stacked Deck ban',
    es: 'el ban de Stacked Deck',
  },
  studied: { total: 20, main: 11, mainMeta: 'Radiance' },
  title: {
    en: 'Diana, Scorn of the Moon deck guide',
    es: 'Guía de Diana, Scorn of the Moon',
  },
  description: {
    en: 'Become a Diana specialist: the core cards from 20 post-ban tournament lists, how the deck wins showdowns, battlefields, mulligan and sideboard.',
    es: 'Vuélvete especialista en Diana: las cartas core de 20 listas de torneo después del ban, cómo gana los showdowns, campos, mulligan y banquillo.',
  },
  intro: {
    en: 'Diana is a Mind/Chaos tempo deck that wins the fights it chooses. It plays cheap units, keeps reactions up and flips showdowns with bounce, might reduction and counters. Lists change every week, but the core below has been in almost every good Diana list since Stacked Deck was banned.',
    es: 'Diana es un mazo de tempo Mente/Caos que gana las peleas que elige. Juega unidades baratas, guarda reacciones y voltea los showdowns con rebotes, reducción de poder y contrahechizos. Las listas cambian cada semana, pero el core de abajo ha estado en casi todas las buenas listas de Diana desde que banearon Stacked Deck.',
  },

  core: [
    { name: 'Tideturner', lists: 11, copies: '3' },
    { name: 'Hwei, Brooding Painter', lists: 11, copies: '3' },
    { name: 'Vex, Apathetic', lists: 11, copies: '2–3' },
    { name: 'Ravenbloom Student', lists: 10, copies: '3' },
    { name: 'Gust', lists: 11, copies: '3' },
    { name: 'Stupefy', lists: 11, copies: '3' },
    { name: 'Ride the Wind', lists: 11, copies: '3' },
    { name: 'Moonfall', lists: 11, copies: '3' },
    { name: 'Star-Crossed', lists: 11, copies: '2' },
    { name: 'Hard Bargain', lists: 11, copies: '1–2' },
    { name: 'Eclipse', lists: 10, copies: '1–2' },
  ],
  flex: [
    { name: 'Fizz, Trickster', lists: 9, copies: '1–2' },
    { name: 'Traveling Merchant', lists: 8, copies: '2–3' },
    { name: 'Flash', lists: 8, copies: '1' },
    { name: "An Offer You Can't Refuse", lists: 6, copies: '1' },
    { name: 'Switcheroo', lists: 6, copies: '1' },
    { name: 'Acceptable Losses', lists: 5, copies: '2' },
    { name: 'Rebuke', lists: 5, copies: '1' },
    { name: 'Retreat', lists: 4, copies: '1–2' },
    { name: 'Sprite Fountain', lists: 4, copies: '2' },
    { name: 'Smoke Screen', lists: 4, copies: '1' },
  ],
  side: [
    { name: 'Decree of Insight', lists: 10, copies: '1–2', why: { en: 'Body decks: −5 might on a Body unit, even through Deflect.', es: 'Mazos de Cuerpo: −5 de poder a una unidad de Cuerpo, incluso con Deflect.' } },
    { name: "An Offer You Can't Refuse", lists: 9, copies: '2', why: { en: 'Gear decks: kills any gear (they get a Gold token).', es: 'Mazos de equipo: destruye cualquier equipo (le queda una ficha de Oro).' } },
    { name: 'Star-Crossed', lists: 9, copies: '1', why: { en: 'Decks with a few huge units: the third copy.', es: 'Mazos con pocas unidades enormes: la tercera copia.' } },
    { name: 'Abandon', lists: 7, copies: '1', why: { en: 'Spell-heavy and control decks: a counter that also predicts.', es: 'Mazos de muchos hechizos y de control: un contrahechizo que además predice.' } },
    { name: 'Ravenbloom Prefect', lists: 5, copies: '1–2', why: { en: 'Gear decks: a body that can banish their next gear.', es: 'Mazos de equipo: una unidad que puede desterrar su siguiente equipo.' } },
    { name: 'Sprite Fountain', lists: 5, copies: '1–2', why: { en: 'Aggro: two ready 3-might blockers over two turns.', es: 'Aggro: dos bloqueadores de 3 de poder listos en dos turnos.' } },
    { name: 'Fizz, Trickster', lists: 5, copies: '1', why: { en: 'Grindy matchups: replays Gust, Stupefy or Moonfall from the trash.', es: 'Partidas largas: rejuega Gust, Stupefy o Moonfall desde el descarte.' } },
    { name: 'Baron Nashor', lists: 4, copies: '1', why: { en: 'Slow matchups: a finisher that can’t be targeted and pumps your team.', es: 'Partidas lentas: un remate que no se puede elegir y le da poder a tu equipo.' } },
    { name: 'Thousand-Tailed Watcher', lists: 4, copies: '1', why: { en: 'Go-wide decks: −3 might to every enemy unit when it lands.', es: 'Mazos de muchas unidades: −3 de poder a todas las unidades enemigas al entrar.' } },
  ],
  battlefields: [
    { name: 'Abandoned Hall', lists: 10, copies: '1' },
    { name: "Targon's Peak", lists: 10, copies: '1' },
    { name: 'Ravenbloom Conservatory', lists: 4, copies: '1' },
    { name: 'Rockfall Path', lists: 4, copies: '1' },
  ],
  runes: {
    en: '6–7 Chaos and 5–6 Mind (12 total). Most lists lean Chaos, since Gust, Ride the Wind, Star-Crossed and the Vex/Tideturner units are Chaos.',
    es: '6–7 de Caos y 5–6 de Mente (12 en total). La mayoría se carga a Caos, porque Gust, Ride the Wind, Star-Crossed, Vex y Tideturner son de Caos.',
  },

  sample: {
    label: {
      en: 'Sample list: 4th place, JHM Cup Ningbo (212 players, Nov 20, 2026), by JHM.太子',
      es: 'Lista de ejemplo: 4.º lugar, JHM Cup Ningbo (212 jugadores, 20 nov 2026), de JHM.太子',
    },
    source: 'https://riftdecks.com/riftbound-metagame/deck-wo-ai-wan-lu-na-358244',
    main: {
      'Ravenbloom Student': 3, Tideturner: 3, 'Traveling Merchant': 2, 'Fizz, Trickster': 1, 'Vex, Apathetic': 2,
      'Hwei, Brooding Painter': 3, 'Vex, Cheerless': 1, 'Sprite Fountain': 2, 'The Good Stuff': 2, Gust: 3, Stupefy: 3,
      "An Offer You Can't Refuse": 1, 'Hard Bargain': 1, Rebuke: 1, 'Ride the Wind': 3, 'Smoke Screen': 1, Switcheroo: 1,
      Eclipse: 1, Moonfall: 3, 'Star-Crossed': 2,
    },
    battlefields: ['Abandoned Hall', 'Ravenbloom Conservatory', "Targon's Peak"],
    runes: { 'Chaos Rune': 6, 'Mind Rune': 6 },
    side: {
      'Decree of Insight': 2, "An Offer You Can't Refuse": 2, 'Hard Bargain': 1, 'Fizz, Trickster': 1, 'Star-Crossed': 1,
      'Vex, Apathetic': 1, 'Angler Beast': 1, 'Unchecked Power': 1,
    },
  },

  sections: {
    en: [
      {
        id: 'engine',
        h: 'The engine: your legend and Lunari',
        p: [
          'Scorn of the Moon exhausts to add 1 energy that you can only spend during showdowns. Every turn you start a fight, or get attacked, you have one extra energy for a [[Gust]] or a [[Stupefy]], or a discount on a bigger reaction. That is why the deck is full of 1–3 cost reactions: in combat it is always a little cheaper than it looks.',
          'Your champion, [[Diana, Lunari]], pays 1 when a showdown begins at her battlefield to Predict, then reveals the top card and draws it if it’s a spell. With about 20 spells in 40 cards, roughly half of those reveals are a free card, and Predict lets you set the top card up first.',
        ],
      },
      {
        id: 'core',
        h: 'What each core piece does',
        p: [
          '<b>Movement.</b> [[Tideturner]] hides for one rune and comes out for 0 energy later, swapping places with another of your units: pull a unit out of a lost fight, or drop [[Hwei, Brooding Painter]] or [[Vex, Apathetic]] into one. [[Ride the Wind]] moves a unit and readies it, so it can join a showdown or fight again.',
          '<b>Showdown tricks.</b> [[Gust]] bounces a unit with 3 might or less, [[Stupefy]] shrinks a unit and draws a card, [[Eclipse]] gives −4 and predicts, [[Star-Crossed]] returns one of yours and one of theirs to hand, and [[Hard Bargain]] taxes or counters their key spell. All of them are reactions, so you play them after the opponent commits.',
          '<b>Board control.</b> [[Moonfall]] drags an enemy unit into a battlefield where you have units and gives every enemy there −2 might: it wins a fight or clears small units. [[Vex, Apathetic]] sits on a battlefield with Deflect and stuns every unit the opponent plays while she is there, so units that enter ready or straight into combat lose their turn.',
          '<b>Card advantage.</b> [[Hwei, Brooding Painter]] loots every time he moves and gets a bonus based on what you discard: discard a spell to draw again, a unit for +3 might. Every movement card above also triggers him. [[Ravenbloom Student]] gets +1 might for every spell you play that turn, so a showdown with two reactions turns a 2-cost unit into a real threat.',
        ],
      },
      {
        id: 'plan',
        h: 'How to play it',
        p: [
          'Early, play your 2-cost units ([[Ravenbloom Student]], [[Tideturner]], [[Traveling Merchant]]) and keep energy for a reaction instead of tapping out. You are not trying to win every battlefield: you are trying to make every fight the opponent takes cost them a card.',
          'In the midgame, [[Hwei, Brooding Painter]] and [[Vex, Apathetic]] take over. Move Hwei every turn you can, and park Vex on the battlefield the opponent needs. Pick the showdowns where your legend’s energy plus your open runes let you answer anything.',
          'To close, save [[Moonfall]] and [[Star-Crossed]] for the turn that decides a battlefield: removing their best blocker and shrinking the rest usually wins it outright.',
        ],
        list: [
          'Battlefields: [[Abandoned Hall]] gives +1 might to one of your units there each time you play a spell, and [[Targon\'s Peak]] readies 2 runes at the end of a turn you conquer there, so you still have reactions on their turn. Both are in 10 of 11 lists; the third one changes.',
          'With [[Fizz, Trickster]], [[Star-Crossed]] can bounce your own Fizz so you replay it and cast another spell from your trash for free.',
        ],
      },
      {
        id: 'mulligan',
        h: 'Mulligan',
        draft: true,
        p: [
          'Look for one or two 2-cost units plus a cheap reaction. A hand with [[Ravenbloom Student]] or [[Tideturner]] and a [[Gust]] or [[Stupefy]] is a keep. Several 3-cost spells and no early unit is the hand to send back: the deck can’t use [[Moonfall]] or [[Star-Crossed]] without units on the board.',
        ],
      },
      {
        id: 'side',
        h: 'Sideboard',
        p: [
          'The sideboard answers specific decks rather than adding raw power. The table below shows what good players bring and against what.',
        ],
      },
      {
        id: 'ban',
        h: 'What changed after the Stacked Deck ban',
        p: [
          'Before September 18, Diana lists played two or three Stacked Deck for consistency. Without it, the lists traded card selection for interaction. Comparing 9 Vendetta lists after the ban with 11 Radiance lists: [[Eclipse]] went from 3 of 9 lists to 10 of 11, [[Hard Bargain]] from 6 of 9 to all 11, and [[Traveling Merchant]] from 4 of 9 to 8 of 11. [[Acceptable Losses]] and [[Smoke Screen]] became less common, and Radiance added [[An Offer You Can\'t Refuse]] as the answer to gear.',
          'The November 23 ban didn’t touch any card in these lists.',
        ],
      },
    ],
    es: [
      {
        id: 'engine',
        h: 'El motor: tu leyenda y Lunari',
        p: [
          'Scorn of the Moon se agota para dar 1 de energía que solo puedes gastar durante los showdowns. Cada turno que empiezas una pelea, o te atacan, tienes una energía extra para un [[Gust]] o un [[Stupefy]], o un descuento en una reacción más grande. Por eso el mazo está lleno de reacciones de 1 a 3: en combate siempre te cuesta un poco menos de lo que parece.',
          'Tu campeona, [[Diana, Lunari]], paga 1 cuando empieza un showdown en su campo para Predecir, luego revela la carta de arriba y la roba si es un hechizo. Con unos 20 hechizos en 40 cartas, más o menos la mitad de esas veces es una carta gratis, y Predecir te deja acomodar la de arriba antes.',
        ],
      },
      {
        id: 'core',
        h: 'Qué hace cada pieza del core',
        p: [
          '<b>Movimiento.</b> [[Tideturner]] se esconde por una runa y sale después por 0 de energía, cambiando de lugar con otra de tus unidades: saca una unidad de una pelea perdida, o mete a [[Hwei, Brooding Painter]] o a [[Vex, Apathetic]] en una. [[Ride the Wind]] mueve una unidad y la prepara, así que puede entrar a un showdown o pelear otra vez.',
          '<b>Trucos de showdown.</b> [[Gust]] regresa una unidad de 3 de poder o menos, [[Stupefy]] encoge una unidad y roba una carta, [[Eclipse]] da −4 y predice, [[Star-Crossed]] regresa a la mano una tuya y una suya, y [[Hard Bargain]] cobra o anula su hechizo clave. Todas son reacciones: las juegas cuando el rival ya se comprometió.',
          '<b>Control del tablero.</b> [[Moonfall]] arrastra una unidad enemiga a un campo donde tienes unidades y da −2 de poder a todos los enemigos ahí: gana una pelea o limpia unidades chicas. [[Vex, Apathetic]] se queda en un campo con Deflect y aturde cada unidad que juegue el rival mientras ella esté ahí, así que las que entran listas o directo al combate pierden su turno.',
          '<b>Ventaja de cartas.</b> [[Hwei, Brooding Painter]] roba y descarta cada vez que se mueve, y gana un extra según lo que descartes: un hechizo para robar otra, una unidad para +3 de poder. Todas las cartas de movimiento de arriba lo activan. [[Ravenbloom Student]] gana +1 de poder por cada hechizo que juegues ese turno, así que un showdown con dos reacciones convierte una unidad de 2 en una amenaza de verdad.',
        ],
      },
      {
        id: 'plan',
        h: 'Cómo se juega',
        p: [
          'Al principio, juega tus unidades de 2 ([[Ravenbloom Student]], [[Tideturner]], [[Traveling Merchant]]) y guarda energía para una reacción en lugar de gastarlo todo. No buscas ganar todos los campos: buscas que cada pelea que tome el rival le cueste una carta.',
          'A mitad de partida mandan [[Hwei, Brooding Painter]] y [[Vex, Apathetic]]. Mueve a Hwei cada turno que puedas y deja a Vex en el campo que el rival necesita. Elige los showdowns donde la energía de tu leyenda más tus runas libres te dejan responder a todo.',
          'Para cerrar, guarda [[Moonfall]] y [[Star-Crossed]] para el turno que decide un campo: quitar su mejor bloqueador y encoger al resto casi siempre lo gana.',
        ],
        list: [
          'Campos: [[Abandoned Hall]] da +1 de poder a una de tus unidades ahí cada vez que juegas un hechizo, y [[Targon\'s Peak]] prepara 2 runas al final del turno en que conquistas ahí, así que sigues teniendo reacciones en el turno del rival. Los dos están en 10 de 11 listas; el tercero cambia.',
          'Con [[Fizz, Trickster]], [[Star-Crossed]] puede regresar a tu propio Fizz para volver a jugarlo y lanzar gratis otro hechizo de tu descarte.',
        ],
      },
      {
        id: 'mulligan',
        h: 'Mulligan',
        draft: true,
        p: [
          'Busca una o dos unidades de 2 y una reacción barata. Una mano con [[Ravenbloom Student]] o [[Tideturner]] y un [[Gust]] o [[Stupefy]] se queda. Varios hechizos de 3 y ninguna unidad temprana es la mano que regresas: el mazo no aprovecha [[Moonfall]] ni [[Star-Crossed]] sin unidades en la mesa.',
        ],
      },
      {
        id: 'side',
        h: 'Banquillo',
        p: [
          'El banquillo responde a mazos concretos más que sumar poder. La tabla de abajo muestra qué llevan los buenos jugadores y contra qué.',
        ],
      },
      {
        id: 'ban',
        h: 'Qué cambió después del ban de Stacked Deck',
        p: [
          'Antes del 18 de septiembre, las listas de Diana llevaban dos o tres Stacked Deck para ser constantes. Sin él, cambiaron selección de cartas por interacción. Comparando 9 listas de Vendetta después del ban con 11 de Radiance: [[Eclipse]] pasó de 3 de 9 listas a 10 de 11, [[Hard Bargain]] de 6 de 9 a las 11, y [[Traveling Merchant]] de 4 de 9 a 8 de 11. [[Acceptable Losses]] y [[Smoke Screen]] se ven menos, y Radiance trajo [[An Offer You Can\'t Refuse]] como respuesta al equipo.',
          'El ban del 23 de noviembre no tocó ninguna carta de estas listas.',
        ],
      },
    ],
  },

  sources: [
    { date: '2026-11-22', event: 'S5 Ningbo Regional Open', place: '46th', players: 1280, player: '闪电家.乐事.li', meta: 'Radiance' },
    { date: '2026-11-22', event: 'S5 Ningbo Regional Open', place: '88th', players: 1280, player: 'JHM.太子', meta: 'Radiance' },
    { date: '2026-11-22', event: 'S5 Ningbo Regional Open', place: '96th', players: 1280, player: '少吃萝卜', meta: 'Radiance' },
    { date: '2026-11-20', event: 'JHM Cup: Ningbo', place: '4th', players: 212, player: 'JHM.太子', meta: 'Radiance' },
    { date: '2026-11-20', event: 'JHM Cup: Ningbo', place: '14th', players: 212, player: '闪电家.乐事.li', meta: 'Radiance' },
    { date: '2026-11-14', event: 'S5 Shenzhen City Challenge', place: '8th', players: 124, player: '撸蛇', meta: 'Radiance' },
    { date: '2026-11-14', event: 'S5 Shenzhen City Challenge', place: '9th', players: 124, player: 'Joyspace_pggg', meta: 'Radiance' },
    { date: '2026-11-01', event: 'S5 Guangzhou City Challenge', place: '10th', players: 128, player: 'LineKa·Pokuey', meta: 'Radiance' },
    { date: '2026-10-31', event: 'S5 Fuzhou City Challenge', place: '11th', players: 115, player: '少吃萝卜', meta: 'Radiance' },
    { date: '2026-10-23', event: 'Melbourne Showdown 2026', place: '11th', players: 251, player: 'Isaac c', meta: 'Radiance' },
    { date: '2026-10-23', event: 'Melbourne Showdown 2026', place: '23rd', players: 251, player: 'Ahdenny', meta: 'Radiance' },
    { date: '2026-10-11', event: 'S4 Chengdu National Open', place: '99th', players: 1835, player: '林北帅到失眠', meta: 'Vendetta' },
    { date: '2026-10-11', event: 'S4 Chengdu National Open', place: '171st', players: 1835, player: '少吃萝卜', meta: 'Vendetta' },
    { date: '2026-10-10', event: 'Riftbound Challenge Gdańsk #2', place: '36th', players: 489, player: 'Domantas Z', meta: 'Vendetta' },
    { date: '2026-10-02', event: 'S4 Harbin City Challenge', place: '3rd', players: 85, player: '潮玩派·FSW·雪落', meta: 'Vendetta' },
    { date: '2026-09-27', event: 'S4 Fuzhou City Challenge', place: '4th', players: 98, player: '少吃萝卜', meta: 'Vendetta' },
    { date: '2026-09-26', event: 'Regional Qualifier Los Angeles', place: 'Top 32', players: 2165, player: 'ASC nalkpas', meta: 'Vendetta' },
    { date: '2026-09-26', event: 'Showdown Series Bristol', place: '46th', players: 503, player: 'Dominic S', meta: 'Vendetta' },
    { date: '2026-09-26', event: 'Riftbound Showdown Series', place: '4th', players: 345, player: 'Emil B', meta: 'Vendetta' },
    { date: '2026-09-26', event: 'Riftbound Showdown Series', place: '18th', players: 345, player: 'Marcus F', meta: 'Vendetta' },
  ],
  sourcesUrl: 'https://riftdecks.com/legends/constructed/diana-scorn-of-the-moon',
};

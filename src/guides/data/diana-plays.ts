// Jugadas clave de Diana como guiones del visualizador (se ven animadas en la guía).
// Los comandos van en inglés (sirven en las dos versiones); solo cambian los textos.
// La mesa se acomoda al empezar con "put" (sin animación); la jugada empieza en el primer "turn".
// Revisadas contra las reglas (core rules 2026-10-09) por la sesión de reglas de Riftbound.
import type { GuidePlay } from '../types';

const head = (title: string, opp: string) => `# ${title}
player p1 "Diana"
player p2 "${opp}"
legend p1 "Diana - Scorn of the Moon"
champion p1 "Diana - Lunari"
battlefield A "Abandoned Hall"
battlefield B "Targon's Peak"
hand p1 3
hand p2 4
goal 8`;

type T = Record<string, string>;

const swap = (t: T) => `${head(t.title, t.opp)}
put p1 "Ravenbloom Student" at A
put p1 "Tideturner" at A hidden
put p1 "Hwei - Brooding Painter" at base
put p2 "Battering Ram" at base
runes p1 4

hold p1 A
turn p2
phase "${t.attack}"
text "${t.board}"
move p2 "Battering Ram" to A
exhaust "Battering Ram"
combat A
text "${t.losing}"
pause 1
play p1 "Tideturner"
text "${t.reveal}"
move p1 "Tideturner" to base
move p1 "Hwei - Brooding Painter" to A
text "${t.hwei}"
might "Hwei - Brooding Painter" +3
pause 1
text "${t.math}"
damage "Battering Ram" 10
dies "Battering Ram"
damage "Ravenbloom Student" 2
dies "Ravenbloom Student"
damage "Hwei - Brooding Painter" 3
text "${t.end}"
pause 2
`;

const moonfall = (t: T) => `${head(t.title, t.opp)}
put p2 "Carnivorous Snapvine" at A
put p2 "Bilgewater Tracker" at A
put p2 "Shipyard Skulker" at base
put p1 "Vex - Apathetic" at base
put p1 "Ravenbloom Student" at base
put p1 "Fizz - Trickster" at base
runes p1 7

hold p2 A
turn p1
phase "${t.go}"
move p1 "Vex - Apathetic" to A
move p1 "Ravenbloom Student" to A
exhaust "Vex - Apathetic"
exhaust "Ravenbloom Student"
combat A
exhaust "Diana - Scorn of the Moon"
text "${t.legend}"
play p1 "Moonfall"
move p2 "Shipyard Skulker" to A
text "${t.moonfall}"
might "Carnivorous Snapvine" -2
might "Bilgewater Tracker" -2
might "Shipyard Skulker" -2
might "Ravenbloom Student" +1
might "Vex - Apathetic" +1
text "${t.hall}"
pause 1
play p1 "Star-Crossed"
return "Carnivorous Snapvine"
return "Fizz - Trickster"
text "${t.star}"
might "Ravenbloom Student" +1
might "Vex - Apathetic" +1
runes p1 5
text "${t.cost}"
pause 1
text "${t.math}"
damage "Bilgewater Tracker" 1
dies "Bilgewater Tracker"
damage "Shipyard Skulker" 1
dies "Shipyard Skulker"
damage "Ravenbloom Student" 2
conquer p1 A
points p1 +1
text "${t.end}"
pause 2
`;

const fizz = (t: T) => `${head(t.title, t.opp)}
put p2 "Carnivorous Snapvine" at B
put p1 "Vex - Apathetic" at A
put p1 "Ravenbloom Student" at base
put p1 "Star-Crossed" at trash
put p1 "Fizz - Trickster" at hand
runes p1 6

hold p1 A
hold p2 B
turn p1
phase "${t.turn}"
text "${t.setup}"
play p1 "Fizz - Trickster" to base
text "${t.fizz}"
play p1 "Star-Crossed" from trash recycle
return "Carnivorous Snapvine"
return "Fizz - Trickster"
text "${t.star}"
pause 1
move p1 "Ravenbloom Student" to B
exhaust "Ravenbloom Student"
text "${t.showdown}"
conquer p1 B
points p1 +1
text "${t.end}"
pause 2
`;

export const DIANA_PLAYS: GuidePlay[] = [
  {
    id: 'swap',
    title: { en: 'Tideturner swaps Hwei into a lost fight', es: 'Tideturner mete a Hwei en una pelea perdida' },
    desc: {
      en: 'The opponent attacks your Student with a bigger unit. Tideturner comes out of hiding, swaps places with Hwei, and Hwei’s move trigger turns the fight around.',
      es: 'El rival ataca a tu Student con una unidad más grande. Tideturner sale de su escondite, cambia de lugar con Hwei, y lo que gana Hwei al moverse voltea la pelea.',
    },
    script: {
      en: swap({
        title: 'Tideturner swaps Hwei into a lost fight', opp: 'Opponent', attack: 'The opponent attacks A',
        board: 'You hold A with the Student, and Tideturner is hidden there since an earlier turn. Hwei waits at base',
        losing: '5 might against 2: the Student loses this fight',
        reveal: 'You reveal Tideturner: that counts as playing it, for 0 energy. It swaps places with Hwei',
        hwei: 'Hwei moved: draw 1, discard a unit, and he gets +3 might this turn',
        math: '8 + 2 might against 5. The opponent splits its 5 damage: here 2 to the Student and 3 to Hwei (it could also put all 5 on Hwei)',
        end: 'The Ram dies, A stays yours, and Tideturner is safe at base',
      }),
      es: swap({
        title: 'Tideturner mete a Hwei en una pelea perdida', opp: 'Rival', attack: 'El rival ataca A',
        board: 'Controlas A con el Student, y Tideturner está escondido ahí desde un turno anterior. Hwei espera en la base',
        losing: '5 de poder contra 2: el Student pierde esta pelea',
        reveal: 'Revelas Tideturner: eso cuenta como jugarlo, por 0 de energía. Cambia de lugar con Hwei',
        hwei: 'Hwei se movió: roba 1, descarta una unidad y gana +3 de poder este turno',
        math: '8 + 2 de poder contra 5. El rival reparte sus 5 de daño: aquí 2 al Student y 3 a Hwei (también podría poner los 5 en Hwei)',
        end: 'El Ram muere, A sigue siendo tuyo, y Tideturner queda a salvo en la base',
      }),
    },
  },
  {
    id: 'moonfall',
    title: { en: 'Moonfall and Star-Crossed take a battlefield', es: 'Moonfall y Star-Crossed se llevan un campo' },
    desc: {
      en: 'Two spells in one showdown: Moonfall drags a unit off their base and shrinks everything, Star-Crossed sends their biggest unit home and saves your Fizz. Your legend pays part of it.',
      es: 'Dos hechizos en un showdown: Moonfall saca una unidad de su base y encoge a todos, Star-Crossed regresa su unidad más grande y salva a tu Fizz. Tu leyenda paga una parte.',
    },
    script: {
      en: moonfall({
        title: 'Moonfall and Star-Crossed take a battlefield', opp: 'Opponent',
        go: 'Your turn: go for A', legend: 'Combat at A is a showdown: your legend adds 1 energy you can only spend here',
        moonfall: 'Moonfall drags the Skulker from their base into A and gives every enemy there -2',
        hall: 'Each spell: the Student gets +1, and Abandoned Hall gives +1 to one of your units there',
        star: 'Star-Crossed returns their biggest unit and your Fizz to hand',
        cost: 'Two spells of 3 energy + 1 power: your legend pays 1 energy, so it costs 5 runes for energy and 2 recycled for power',
        math: '6 + 4 might against 1 + 1', end: 'Two units dead, one sent home, and A is yours',
      }),
      es: moonfall({
        title: 'Moonfall y Star-Crossed se llevan un campo', opp: 'Rival',
        go: 'Tu turno: vas por A', legend: 'El combate en A es un showdown: tu leyenda da 1 de energía que solo puedes gastar aquí',
        moonfall: 'Moonfall arrastra al Skulker de su base hasta A y da -2 a todos los enemigos ahí',
        hall: 'Cada hechizo: el Student gana +1, y Abandoned Hall da +1 a una de tus unidades ahí',
        star: 'Star-Crossed regresa a la mano su unidad más grande y a tu Fizz',
        cost: 'Dos hechizos de 3 de energía + 1 de poder: tu leyenda paga 1 de energía, así que cuesta 5 runas de energía y 2 recicladas de poder',
        math: '6 + 4 de poder contra 1 + 1', end: 'Dos unidades muertas, una de regreso a la mano, y A es tuyo',
      }),
    },
  },
  {
    id: 'fizz',
    title: { en: 'Fizz recasts Star-Crossed and returns to hand', es: 'Fizz vuelve a lanzar Star-Crossed y regresa a la mano' },
    desc: {
      en: 'The follow-up: replay the Fizz you saved, cast Star-Crossed again from your trash, and return Fizz with it. Their blocker is gone. Star-Crossed is recycled afterwards, so it is not an endless loop.',
      es: 'La continuación: vuelves a jugar el Fizz que salvaste, lanzas otra vez Star-Crossed desde tu descarte y con él regresas a Fizz. Su bloqueador se va. Después Star-Crossed se recicla, así que no es un ciclo infinito.',
    },
    script: {
      en: fizz({
        title: 'Fizz recasts Star-Crossed and returns to hand', opp: 'Opponent', turn: 'Your turn',
        setup: 'Star-Crossed is in your trash and Fizz is in your hand. The opponent holds B',
        fizz: 'Fizz: play a spell from your trash that costs 3 or less without paying its energy (you still pay its power)',
        star: 'Their unit goes home and Fizz returns to your hand. Star-Crossed is recycled to the bottom of your deck',
        showdown: 'B has no enemies left: a showdown opens there, and if nobody acts, you conquer',
        end: 'The Student, ready because it wasn’t played this turn, takes B. Next time Fizz needs another spell in your trash',
      }),
      es: fizz({
        title: 'Fizz vuelve a lanzar Star-Crossed y regresa a la mano', opp: 'Rival', turn: 'Tu turno',
        setup: 'Star-Crossed está en tu descarte y Fizz en tu mano. El rival controla B',
        fizz: 'Fizz: juega un hechizo de tu descarte que cueste 3 o menos sin pagar su energía (el poder sí se paga)',
        star: 'Su unidad regresa a la mano y Fizz a la tuya. Star-Crossed se recicla al fondo de tu mazo',
        showdown: 'B se quedó sin enemigos: se abre un showdown ahí, y si nadie actúa, conquistas',
        end: 'El Student, listo porque no se jugó este turno, toma B. La próxima vez Fizz necesita otro hechizo en tu descarte',
      }),
    },
  },
];

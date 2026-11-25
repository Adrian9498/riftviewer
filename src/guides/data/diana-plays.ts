// Jugadas clave de Diana como guiones del visualizador (se ven animadas en la guía).
// Los comandos van en inglés (sirven en las dos versiones); solo cambian los textos.
// La primera fase de cada guion ("Starting board") solo acomoda la mesa: no es una jugada real.
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
goal 8
`;

type T = Record<string, string>;
const swap = (t: T) => `${head(t.title, t.opp)}
turn p1
phase "${t.board}"
play p1 "Hwei - Brooding Painter" to base
play p1 "Ravenbloom Student" to A
hold p1 A
play p2 "Battering Ram" to base
text "${t.hidden}"
pause 1

turn p2
phase "${t.attack}"
move p2 "Battering Ram" to A
combat A
text "${t.losing}"
pause 1
play p1 "Tideturner" to A
text "${t.reveal}"
move p1 "Tideturner" to base
move p1 "Hwei - Brooding Painter" to A
draw p1
text "${t.hwei}"
might "Hwei - Brooding Painter" +3
pause 1
text "${t.math}"
damage "Battering Ram" 5
dies "Battering Ram"
damage "Ravenbloom Student" 2
dies "Ravenbloom Student"
damage "Hwei - Brooding Painter" 3
hold p1 A
text "${t.end}"
pause 2
`;

const moonfall = (t: T) => `${head(t.title, t.opp)}
turn p2
phase "${t.board}"
play p2 "Carnivorous Snapvine" to A
play p2 "Bilgewater Tracker" to A
hold p2 A
play p2 "Shipyard Skulker" to base
play p1 "Vex - Apathetic" to base
play p1 "Ravenbloom Student" to base
play p1 "Fizz - Trickster" to base
pause 1

turn p1
phase "${t.go}"
runes p1 7
move p1 "Vex - Apathetic" to A
move p1 "Ravenbloom Student" to A
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
turn p2
phase "${t.board}"
play p2 "Carnivorous Snapvine" to B
hold p2 B
play p1 "Vex - Apathetic" to A
hold p1 A
play p1 "Ravenbloom Student" to base
play p1 "Star-Crossed"
draw p1 "Fizz - Trickster"
text "${t.setup}"
pause 1

turn p1
phase "${t.turn}"
play p1 "Fizz - Trickster" to base
text "${t.fizz}"
play p1 "Star-Crossed"
return "Carnivorous Snapvine"
return "Fizz - Trickster"
text "${t.star}"
pause 1
move p1 "Ravenbloom Student" to B
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
        title: 'Tideturner swaps Hwei into a lost fight', opp: 'Opponent', board: 'Starting board',
        hidden: 'Tideturner is hidden face down at A', attack: 'The opponent attacks A',
        losing: '5 might against 2: the Student loses this fight',
        reveal: 'Tideturner comes out for 0 energy and swaps places with Hwei',
        hwei: 'Hwei moved: draw 1, discard a unit, and he gets +3 might this turn',
        math: '8 + 2 might against 5. The opponent splits its 5 damage: here 2 to the Student and 3 to Hwei (it could also put all 5 on Hwei)', end: 'A stays yours, and Tideturner is safe at base',
      }),
      es: swap({
        title: 'Tideturner mete a Hwei en una pelea perdida', opp: 'Rival', board: 'La mesa al empezar',
        hidden: 'Tideturner está escondido boca abajo en A', attack: 'El rival ataca A',
        losing: '5 de poder contra 2: el Student pierde esta pelea',
        reveal: 'Tideturner sale por 0 de energía y cambia de lugar con Hwei',
        hwei: 'Hwei se movió: roba 1, descarta una unidad y gana +3 de poder este turno',
        math: '8 + 2 de poder contra 5. El rival reparte sus 5 de daño: aquí 2 al Student y 3 a Hwei (también podría poner los 5 en Hwei)', end: 'A sigue siendo tuyo, y Tideturner queda a salvo en la base',
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
        title: 'Moonfall and Star-Crossed take a battlefield', opp: 'Opponent', board: 'Starting board',
        go: 'Your turn: go for A', cost: 'Two spells of 3 energy + 1 power: your legend pays 1 energy, so it costs 5 runes for energy and 2 recycled for power', legend: 'Showdown at A: your legend adds 1 energy you can only spend here',
        moonfall: 'Moonfall drags the Skulker from their base into A and gives every enemy there -2',
        hall: 'Each spell: the Student gets +1, and Abandoned Hall gives +1 to one of your units there',
        star: 'Star-Crossed returns their biggest unit and your Fizz to hand',
        math: '6 + 4 might against 1 + 1', end: 'Two units dead, one sent home, and A is yours',
      }),
      es: moonfall({
        title: 'Moonfall y Star-Crossed se llevan un campo', opp: 'Rival', board: 'La mesa al empezar',
        go: 'Tu turno: vas por A', cost: 'Dos hechizos de 3 de energía + 1 de poder: tu leyenda paga 1 de energía, así que cuesta 5 runas de energía y 2 recicladas de poder', legend: 'Showdown en A: tu leyenda da 1 de energía que solo puedes gastar aquí',
        moonfall: 'Moonfall arrastra al Skulker de su base hasta A y da -2 a todos los enemigos ahí',
        hall: 'Cada hechizo: el Student gana +1, y Abandoned Hall da +1 a una de tus unidades ahí',
        star: 'Star-Crossed regresa a la mano su unidad más grande y a tu Fizz',
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
        title: 'Fizz recasts Star-Crossed and returns to hand', opp: 'Opponent', board: 'Starting board',
        setup: 'Star-Crossed is in your trash and Fizz is back in your hand', turn: 'Your next turn',
        fizz: 'Fizz: play a spell from your trash that costs 3 or less, without paying its energy',
        star: 'Their unit goes home, Fizz returns to your hand, and Star-Crossed is recycled',
        end: 'B is open, so the Student (ready, it wasn’t played this turn) takes it. Star-Crossed went to the bottom of your deck, so next time Fizz needs another spell in your trash',
      }),
      es: fizz({
        title: 'Fizz vuelve a lanzar Star-Crossed y regresa a la mano', opp: 'Rival', board: 'La mesa al empezar',
        setup: 'Star-Crossed está en tu descarte y Fizz volvió a tu mano', turn: 'Tu siguiente turno',
        fizz: 'Fizz: juega un hechizo de tu descarte que cueste 3 o menos, sin pagar su energía',
        star: 'Su unidad regresa a la mano, Fizz vuelve a la tuya y Star-Crossed se recicla',
        end: 'B quedó libre y el Student (listo, no se jugó este turno) lo toma. Star-Crossed se fue al fondo de tu mazo, así que la próxima vez Fizz necesita otro hechizo en tu descarte',
      }),
    },
  },
];

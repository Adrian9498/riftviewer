// Generado a partir de legacy/app.js (sección "demo").


/* ================= Parser ================= */
export const DEMO = `# ===== Ejemplo de guion =====
# Edita, pulsa "Cargar guion" (Ctrl+Enter) y luego Reproducir.
jugador j1 "Adrian"
jugador j2 "Rival"
leyenda j1 "Jinx - Loose Cannon"
leyenda j2 "Vi - Piltover Enforcer"
campo A "Star Spring"
campo B "Trapping Grounds"
mano j1 4
mano j2 4
meta 8

turno j1
fase "Inicio"
runas j1 2
roba j1 "Jinx - Rebel"
juega j1 "Prepared Neophyte" a base
texto "Adrian abre con una unidad barata"

turno j2
runas j2 2
roba j2
juega j2 "Undying Legion" a base
mueve j2 "Undying Legion" a A
controla j2 A
puntos j2 +1

turno j1
prepara j1 todo
runas j1 3
juega j1 "Jinx - Rebel" a base
mueve j1 "Jinx - Rebel" a A
mueve j1 "Prepared Neophyte" a A
texto "¡Jinx va a disputar el campo A!"
combate A
daño "Undying Legion" 3
muere "Undying Legion"
daño "Prepared Neophyte" 1
conquista j1 A
puntos j1 +1
agota "Jinx - Rebel"

turno j2
runas j2 4
juega j2 "Vault Breaker"
texto "Hechizo directo al descarte"
juega j2 "Lord Broadmane" a B
controla j2 B
puntos j2 +1
pausa 1
gana j1
`;
/** El mismo ejemplo con los comandos y textos en inglés. */
export const DEMO_EN = `# ===== Sample script =====
# Edit it, press "Apply changes" (Ctrl+Enter) and then Play.
player p1 "Adrian"
player p2 "Opponent"
legend p1 "Jinx - Loose Cannon"
legend p2 "Vi - Piltover Enforcer"
battlefield A "Star Spring"
battlefield B "Trapping Grounds"
hand p1 4
hand p2 4
goal 8

turn p1
phase "Start"
runes p1 2
draw p1 "Jinx - Rebel"
play p1 "Prepared Neophyte" to base
text "Adrian opens with a cheap unit"

turn p2
runes p2 2
draw p2
play p2 "Undying Legion" to base
move p2 "Undying Legion" to A
hold p2 A
points p2 +1

turn p1
ready p1 all
runes p1 3
play p1 "Jinx - Rebel" to base
move p1 "Jinx - Rebel" to A
move p1 "Prepared Neophyte" to A
text "Jinx is going to contest battlefield A!"
combat A
damage "Undying Legion" 3
dies "Undying Legion"
damage "Prepared Neophyte" 1
conquer p1 A
points p1 +1
exhaust "Jinx - Rebel"

turn p2
runes p2 4
play p2 "Vault Breaker"
text "Spell straight to the trash"
play p2 "Lord Broadmane" to B
hold p2 B
points p2 +1
pause 1
wins p1
`;

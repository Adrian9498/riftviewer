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
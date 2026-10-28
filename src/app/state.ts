// Estado de la app que se modifica desde varios módulos.
// (Lo que solo cambia dentro de un módulo vive como variable local de ese módulo.)

export interface AppState {
  /** hay una reproducción en curso */
  playing: boolean;
  /** multiplicador de velocidad (0.5×–3×) */
  speed: number;
  /** se incrementa para cancelar animaciones/reproducciones en curso */
  token: number;
  /** replay abierto, o null en modo guion */
  R: any;
  /** colores de los jugadores (según "Mi marca") */
  PCOL: string[];
}

export const app: AppState = {
  playing: false,
  speed: 1,
  token: 0,
  R: null,
  PCOL: ['#3fa9ff', '#ff5a6e', '#b57bff', '#45d483'],
};

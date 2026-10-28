import { describe, expect, it } from 'vitest';
import { chaptersText, cleanChapters, fmtTime } from '../src/replay/chapters';

describe('capítulos de YouTube', () => {
  it('formatea minutos y horas', () => {
    expect(fmtTime(0)).toBe('0:00');
    expect(fmtTime(75.9)).toBe('1:15');
    expect(fmtTime(3725)).toBe('1:02:05');
  });

  it('empieza en 0:00, quita repetidos y junta los de menos de 10 s', () => {
    const cs = cleanChapters([
      { t: 2, label: 'Mulligan' },
      { t: 20, label: 'Turno 1' },
      { t: 24, label: 'Turno 1' },      // repetido
      { t: 50, label: 'Turno 2' },      // dura 5 s: se junta
      { t: 55, label: 'Turno 3' },
      { t: 90, label: 'Turno 4' },
    ], 130);
    expect(chaptersText(cs)).toBe('0:00 Mulligan\n0:20 Turno 1\n0:55 Turno 3\n1:30 Turno 4');
  });

  it('une la última si quedó demasiado corta', () => {
    const cs = cleanChapters([{ t: 0, label: 'Turno 1' }, { t: 40, label: 'Turno 2' }, { t: 95, label: 'Turno 3' }], 100);
    expect(cs.map(c => c.label)).toEqual(['Turno 1', 'Turno 2']);
  });
});

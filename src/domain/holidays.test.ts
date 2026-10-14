import { easterSunday, holidaysForYear, holidaysInRange, nationalHolidays } from './holidays';

describe('easterSunday', () => {
  it.each([
    [2000, '2000-04-23'],
    [2019, '2019-04-21'],
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2028, '2028-04-16'],
    [2029, '2029-04-01'],
    [2030, '2030-04-21'],
    [2031, '2031-04-13'],
    [2032, '2032-03-28'],
    [2033, '2033-04-17'],
    [2034, '2034-04-09'],
    [2035, '2035-03-25'],
  ])('%d → %s', (year, expected) => expect(easterSunday(year)).toBe(expected));
});

describe('nationalHolidays', () => {
  it('2026 tem 10 feriados nacionais, incluindo Sexta-feira Santa e Consciência Negra', () => {
    const list = nationalHolidays(2026);
    expect(list).toHaveLength(10);
    expect(list.find((h) => h.key === 'sexta-santa')!.date).toBe('2026-04-03');
    expect(list.find((h) => h.key === 'consciencia-negra')!.date).toBe('2026-11-20');
  });

  it('pontos facultativos só quando ligados', () => {
    expect(nationalHolidays(2026).some((h) => h.kind === 'optional')).toBe(false);
    const withOptional = nationalHolidays(2026, { includeOptional: true });
    expect(withOptional.find((h) => h.key === 'carnaval-terca')!.date).toBe('2026-02-17');
    expect(withOptional.find((h) => h.key === 'corpus-christi')!.date).toBe('2026-06-04');
  });
});

describe('holidaysForYear com overrides', () => {
  it('H4: desativar só em um ano mantém os outros', () => {
    const overrides = [{ kind: 'disabled' as const, holidayKey: 'aparecida', year: 2026 }];
    expect(holidaysForYear(2026, overrides).some((h) => h.key === 'aparecida')).toBe(false);
    expect(holidaysForYear(2027, overrides).some((h) => h.key === 'aparecida')).toBe(true);
  });

  it('H5: feriado próprio recorrente e não recorrente', () => {
    const overrides = [
      { kind: 'custom' as const, id: 'a', name: 'São Sebastião', date: null, monthDay: '01-20' },
      { kind: 'custom' as const, id: 'b', name: 'Aniversário da cidade', date: '2026-08-10', monthDay: null },
    ];
    expect(holidaysForYear(2027, overrides).find((h) => h.name === 'São Sebastião')!.date).toBe('2027-01-20');
    expect(holidaysForYear(2027, overrides).some((h) => h.name === 'Aniversário da cidade')).toBe(false);
    expect(holidaysForYear(2026, overrides).some((h) => h.date === '2026-08-10')).toBe(true);
  });
});

it('holidaysInRange atravessa a virada do ano', () => {
  const map = holidaysInRange('2026-12-21', '2027-01-20', []);
  expect([...map.keys()]).toEqual(['2026-12-25', '2027-01-01']);
});

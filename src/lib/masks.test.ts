import { parseHours } from '@/domain/payslip';
import { HOUR, MINUTE } from '@/domain/time';

import { centsToMoneyMask, maskHours, maskMoney, moneyMaskToCents, msToHoursMask } from './masks';

describe('máscara de dinheiro', () => {
  it.each([
    ['', ''],
    ['1', '0,01'],
    ['12', '0,12'],
    ['123', '1,23'],
    ['2550', '25,50'],
    ['123456', '1.234,56'],
    ['123456789', '1.234.567,89'],
    ['00012', '0,12'],
    ['R$ 1.234,56', '1.234,56'],
  ])('%p → %p', (typed, masked) => {
    expect(maskMoney(typed)).toBe(masked);
  });

  it('ida e volta em centavos', () => {
    expect(centsToMoneyMask(123456)).toBe('1.234,56');
    expect(moneyMaskToCents('1.234,56')).toBe(123456);
    expect(moneyMaskToCents('')).toBeNull();
    expect(centsToMoneyMask(null)).toBe('');
  });
});

describe('máscara de horas', () => {
  it.each([
    ['', 'clock', ''],
    ['5', 'clock', '0:05'],
    ['130', 'clock', '1:30'],
    ['1230', 'clock', '12:30'],
    ['1250', 'decimal', '12,50'],
    ['5', 'decimal', '0,05'],
  ] as const)('%p (%s) → %p', (typed, format, masked) => {
    expect(maskHours(typed, format)).toBe(masked);
  });

  it('o texto mascarado é lido pela conferência do holerite', () => {
    expect(parseHours(maskHours('1230', 'clock'), 'clock')).toBe(12 * HOUR + 30 * MINUTE);
    expect(parseHours(maskHours('1250', 'decimal'), 'decimal')).toBe(12 * HOUR + 30 * MINUTE);
  });

  it('converte duração para a máscara', () => {
    expect(msToHoursMask(12 * HOUR + 30 * MINUTE, 'clock')).toBe('12:30');
    expect(msToHoursMask(12 * HOUR + 30 * MINUTE, 'decimal')).toBe('12,50');
    expect(msToHoursMask(null, 'clock')).toBe('');
  });
});

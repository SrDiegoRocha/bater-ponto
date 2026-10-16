import type { HoursFormat } from '@/domain/payslip';
import { HOUR, MINUTE } from '@/domain/time';

// Máscaras de digitação: o usuário só digita números, e o app põe ponto, vírgula e dois-pontos.
// Os dígitos entram pela direita, como em caixa eletrônico: 1 → 0,01 · 12 → 0,12 · 1234 → 12,34.

/** Só os dígitos, sem zeros à esquerda e com limite de tamanho */
export function onlyDigits(text: string, maxLength = 11): string {
  return text.replace(/\D/g, '').replace(/^0+/, '').slice(0, maxLength);
}

/** "123456" → "1.234,56" (moeda brasileira, sem o "R$"). Vazio continua vazio. */
export function maskMoney(text: string): string {
  const digits = onlyDigits(text);
  if (!digits) return '';
  const padded = digits.padStart(3, '0');
  const reais = padded.slice(0, -2).replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${reais},${padded.slice(-2)}`;
}

/** Centavos → texto da máscara (null = campo vazio) */
export function centsToMoneyMask(cents: number | null): string {
  return cents === null || cents <= 0 ? '' : maskMoney(String(Math.round(cents)));
}

/** Texto da máscara → centavos (vazio = null) */
export function moneyMaskToCents(text: string): number | null {
  const digits = onlyDigits(text);
  return digits ? Number(digits) : null;
}

/**
 * Horas com os dois últimos dígitos depois do separador:
 * relógio "1230" → "12:30" (minutos) · decimal "1250" → "12,50" (centésimos de hora).
 */
export function maskHours(text: string, format: HoursFormat): string {
  const digits = onlyDigits(text, 5);
  if (!digits) return '';
  const padded = digits.padStart(3, '0');
  const whole = String(Number(padded.slice(0, -2)));
  return `${whole}${format === 'clock' ? ':' : ','}${padded.slice(-2)}`;
}

/** Duração → texto da máscara de horas, no formato escolhido */
export function msToHoursMask(ms: number | null, format: HoursFormat): string {
  if (ms === null) return '';
  const totalMinutes = Math.round(ms / MINUTE);
  if (format === 'clock') {
    return maskHours(`${Math.floor(totalMinutes / 60)}${String(totalMinutes % 60).padStart(2, '0')}`, 'clock');
  }
  return maskHours(String(Math.round((ms / HOUR) * 100)), 'decimal');
}

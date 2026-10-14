/** Lê um valor digitado em R$: aceita "25,50", "25.50" e "1.234,56". Retorna null se inválido. */
export function parseMoney(text: string): number | null {
  const normalized = text.replace(/[^\d,.]/g, '').replace(/\.(?=.*[.,])/g, '').replace(',', '.');
  if (!normalized) return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : null;
}

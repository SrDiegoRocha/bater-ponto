// Tabelas de descontos vigentes em 2026 (empregado CLT). Atualizar a cada ano.
//
// INSS: Portaria Interministerial MPS/MF nº 13/2026 — alíquotas progressivas por faixa, teto R$ 8.475,55.
// IRRF: tabela mensal da Lei 15.191/2025 + redutor da Lei 15.270/2025 (isenção até R$ 5.000),
//       conforme publicado pela Receita Federal (gov.br/receitafederal → Tabelas 2026).

export const TAX_YEAR = 2026;

/** Faixas do INSS: [teto da faixa, alíquota] — cada alíquota incide só sobre a parte do salário na faixa */
export const INSS_BRACKETS: readonly [number, number][] = [
  [1621.0, 0.075],
  [2902.84, 0.09],
  [4354.27, 0.12],
  [8475.55, 0.14],
];

/** IRRF mensal: [base até, alíquota, parcela a deduzir] */
export const IRRF_TABLE: readonly [number, number, number][] = [
  [2428.8, 0, 0],
  [2826.65, 0.075, 182.16],
  [3751.05, 0.15, 394.16],
  [4664.68, 0.225, 675.49],
  [Infinity, 0.275, 908.73],
];

export const IRRF_DEPENDENT_DEDUCTION = 189.59;
export const IRRF_SIMPLIFIED_DISCOUNT = 607.2;
export const IRRF_EXEMPT_UP_TO = 5000;
export const IRRF_REDUCTION_LIMIT = 7350;

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Contribuição do INSS do empregado (em reais) */
export function inss(gross: number): number {
  // Aritmética inteira (centavos × milésimos) para não errar o arredondamento de meio centavo
  const grossCents = Math.round(gross * 100);
  let totalMilliCents = 0;
  let lower = 0;
  for (const [upper, rate] of INSS_BRACKETS) {
    const upperCents = Math.round(upper * 100);
    if (grossCents <= lower) break;
    totalMilliCents += (Math.min(grossCents, upperCents) - lower) * Math.round(rate * 1000);
    lower = upperCents;
  }
  return Math.round(totalMilliCents / 1000) / 100;
}

/** IRRF mensal (em reais). Usa a dedução mais vantajosa: legal (INSS + dependentes) ou desconto simplificado. */
export function irrf(gross: number, inssValue: number, dependents = 0): number {
  const legal = inssValue + dependents * IRRF_DEPENDENT_DEDUCTION;
  const base = Math.max(0, gross - Math.max(legal, IRRF_SIMPLIFIED_DISCOUNT));
  const [, rate, deduction] = IRRF_TABLE.find(([upTo]) => base <= upTo)!;
  const tax = Math.max(0, base * rate - deduction);

  // Redutor da Lei 15.270/2025: calculado sobre o rendimento tributável bruto do mês
  const reduction =
    gross <= IRRF_EXEMPT_UP_TO ? tax : gross <= IRRF_REDUCTION_LIMIT ? Math.max(0, 978.62 - 0.133145 * gross) : 0;
  return round2(Math.max(0, tax - reduction));
}

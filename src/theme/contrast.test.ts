import { darkColors, lightColors, textTokens } from './colors';
import { contrastRatio } from './contrast';

describe.each([
  ['escuro', darkColors],
  ['claro', lightColors],
])('contraste do tema %s', (_, colors) => {
  it.each(textTokens)('%s tem ≥ 4,5:1 sobre surface e bg', (token) => {
    expect(contrastRatio(colors[token], colors.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors[token], colors.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('texto sobre a primária tem ≥ 4,5:1', () => {
    expect(contrastRatio(colors.onPrimary, colors.primary)).toBeGreaterThanOrEqual(4.5);
  });

  it('borda é perceptível (≥ 1,2:1) sem pesar', () => {
    expect(contrastRatio(colors.border, colors.surface)).toBeGreaterThanOrEqual(1.2);
  });
});

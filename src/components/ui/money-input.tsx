import { useState } from 'react';

import { maskMoney, moneyMaskToCents } from '@/lib/masks';

import { MaskedInput } from './masked-input';

// Campo de valor em R$ com máscara brasileira: digite só os números (2550 → 25,50).
// O valor (em reais) é salvo ao terminar a edição.

const toText = (reais: number) => (reais > 0 ? maskMoney(String(Math.round(reais * 100))) : '');

export function MoneyInput({ value, onCommit, label }: { value: number; onCommit: (value: number) => void; label: string }) {
  const [text, setText] = useState<string | null>(null);

  const commit = () => {
    if (text === null) return;
    const reais = (moneyMaskToCents(text) ?? 0) / 100;
    setText(null);
    if (reais !== value) onCommit(reais);
  };

  return (
    <MaskedInput
      label={label}
      value={text ?? toText(value)}
      onChangeText={setText}
      mask={maskMoney}
      onEndEditing={commit}
      placeholder="0,00"
      prefix="R$"
      size="lg"
    />
  );
}

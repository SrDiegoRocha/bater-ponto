import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { Text } from '@/components/ui';
import { radius, spacing, useTheme, withAlpha } from '@/theme';

// Horário digitado no teclado numérico, dígito a dígito: "08:02". Cada número é tocável sozinho:
// toque no dígito, digite, e só ele muda (o cursor pula para o próximo). Feito para copiar o horário
// mostrado no app de ponto da empresa sem girar relógio nenhum.
//
// O valor é sempre uma string de 4 posições; posição vazia é ' '. Use parseTypedTime para ler.

export const EMPTY_TIME = '    ';

/** Limite de cada posição: H1 ≤ 2, H2 ≤ 3 quando H1 = 2, M1 ≤ 5 */
function accepts(slots: string, index: number, digit: number): boolean {
  if (index === 0) return digit <= 2;
  if (index === 1) return slots[0] !== '2' || digit <= 3;
  if (index === 2) return digit <= 5;
  return true;
}

const replaceAt = (s: string, i: number, c: string) => s.slice(0, i) + c + s.slice(i + 1);

// O TextInput escondido fica sempre com este texto: a diferença diz se foi digitado ou apagado
const SENTINEL = '00';

export function TimeTyper({
  value,
  onChange,
  invalid = false,
  autoFocus = true,
}: {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  const { colors } = useTheme();
  const input = useRef<TextInput>(null);
  const [cursor, setCursor] = useState(() => Math.max(0, value.indexOf(' ')));
  const [focused, setFocused] = useState(false);
  const [, force] = useState(0);
  const shake = useSharedValue(0);
  const slots = value.padEnd(4, ' ').slice(0, 4);

  // Valor trocado por fora (ex.: "Usar agora"): cursor vai para o fim
  const lastValue = useRef(value);
  useEffect(() => {
    if (value !== lastValue.current && !value.includes(' ')) setCursor(3);
    lastValue.current = value;
  }, [value]);

  const reject = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    shake.set(withSequence(withTiming(-6, { duration: 50 }), withTiming(6, { duration: 50 }), withTiming(0, { duration: 50 })));
  };

  const typeDigits = (typed: string) => {
    let next = slots;
    let at = cursor;
    let wroteLast = false;
    for (const ch of typed) {
      const d = Number(ch);
      if (!accepts(next, at, d)) {
        // "7" na primeira posição só pode ser 07: completa a hora e segue para os minutos
        if (at === 0 && d > 2) {
          next = replaceAt(replaceAt(next, 0, '0'), 1, ch);
          at = 2;
          continue;
        }
        reject();
        break;
      }
      next = replaceAt(next, at, ch);
      if (at === 3) wroteLast = true;
      // H1 = 2 com H2 > 3 (ex.: 29) fica inválido: limpa H2 para digitar de novo
      if (at === 0 && ch === '2' && Number(next[1]) > 3) next = replaceAt(next, 1, ' ');
      at = Math.min(3, at + 1);
    }
    Haptics.selectionAsync().catch(() => {});
    lastValue.current = next;
    onChange(next);
    setCursor(at);
    // Último dígito preenchido e horário completo: fecha o teclado para mostrar o botão de salvar
    if (wroteLast && !next.includes(' ')) Keyboard.dismiss();
  };

  const erase = () => {
    let at = cursor;
    if (slots[at] === ' ' && at > 0) at -= 1;
    const next = replaceAt(slots, at, ' ');
    lastValue.current = next;
    onChange(next);
    setCursor(at);
  };

  const focusSlot = (i: number) => {
    setCursor(i);
    if (input.current?.isFocused() && Keyboard.isVisible()) return;
    // Focado mas com o teclado fechado: o Android só reabre desfocando e focando de novo
    if (input.current?.isFocused()) input.current.blur();
    requestAnimationFrame(() => input.current?.focus());
  };

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const slot = (i: number) => {
    const filled = slots[i] !== ' ';
    const active = focused && i === cursor;
    return (
      <Pressable
        key={i}
        onPress={() => focusSlot(i)}
        accessibilityRole="button"
        accessibilityLabel={`${i < 2 ? 'Hora' : 'Minuto'}, ${i % 2 === 0 ? 'primeiro' : 'segundo'} dígito: ${filled ? slots[i] : 'vazio'}`}
        accessibilityHint="Toque para trocar só este número"
        style={[
          styles.slot,
          {
            backgroundColor: active ? withAlpha(colors.primary, 0.1) : colors.surface,
            borderColor: invalid ? colors.danger : active ? colors.primary : colors.border,
          },
        ]}
      >
        <Text variant="display" tabular color={filled ? 'text' : 'textMuted'} style={styles.digit}>
          {filled ? slots[i] : '–'}
        </Text>
        {active ? <View style={[styles.caret, { backgroundColor: colors.primary }]} /> : null}
      </Pressable>
    );
  };

  return (
    <Animated.View style={[styles.row, shakeStyle]}>
      {slot(0)}
      {slot(1)}
      <Text variant="display" color="textMuted" style={styles.colon}>
        :
      </Text>
      {slot(2)}
      {slot(3)}
      <TextInput
        ref={input}
        value={SENTINEL}
        selection={{ start: SENTINEL.length, end: SENTINEL.length }}
        onChangeText={(t) => {
          if (t.length > SENTINEL.length) {
            const typed = t.slice(SENTINEL.length).replace(/\D/g, '');
            if (typed) typeDigits(typed);
          } else if (t.length < SENTINEL.length) {
            erase();
          }
          // Re-render devolve o texto do campo escondido ao SENTINEL
          force((n) => n + 1);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        autoFocus={autoFocus}
        caretHidden
        contextMenuHidden
        autoCorrect={false}
        importantForAutofill="no"
        style={styles.hidden}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  slot: {
    width: 60,
    height: 80,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Display tem lineHeight maior que a fonte: fixar evita o número "torto" dentro da caixa
  digit: { fontSize: 44, lineHeight: 52, textAlign: 'center', includeFontPadding: false },
  caret: { position: 'absolute', bottom: 10, width: 20, height: 3, borderRadius: 2 },
  colon: { fontSize: 44, lineHeight: 52, includeFontPadding: false, marginBottom: 6 },
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});

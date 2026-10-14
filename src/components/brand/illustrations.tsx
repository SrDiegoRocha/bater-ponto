import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/theme';

// Ilustrações dos estados vazios (§6.7): feitas com a geometria do logo (arcos + pontos),
// uma cor neutra + um acento, em vetor (leves e nítidas em qualquer tela).

export type IllustrationName = 'empty' | 'period' | 'done';

export function Illustration({ name, size = 120 }: { name: IllustrationName; size?: number }) {
  const { colors } = useTheme();
  const neutral = colors.border;
  const accent = colors.primary;

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {name === 'empty' ? (
        <>
          {/* Anel vazio com um ponto esperando no topo: "nenhum registro ainda" */}
          <Circle cx={24} cy={24} r={16} stroke={neutral} strokeWidth={3} fill="none" strokeDasharray="2 5" strokeLinecap="round" />
          <Circle cx={24} cy={8} r={4} fill={accent} />
        </>
      ) : name === 'period' ? (
        <>
          {/* Arcos esmaecidos: "período sem dados" */}
          <Path d="M24 6 A18 18 0 0 1 42 24" stroke={neutral} strokeWidth={3} fill="none" strokeLinecap="round" />
          <Path d="M38 34 A18 18 0 0 1 14 39" stroke={neutral} strokeWidth={3} fill="none" strokeLinecap="round" />
          <Path d="M8 30 A18 18 0 0 1 12 12" stroke={neutral} strokeWidth={3} fill="none" strokeLinecap="round" />
          <Circle cx={24} cy={24} r={3} fill={accent} />
        </>
      ) : (
        <>
          {/* Anel fechado com o ponto: "tudo certo" */}
          <Circle cx={24} cy={24} r={16} stroke={accent} strokeWidth={3} fill="none" />
          <Path d="M17 24.5 L22 29.5 L31 19" stroke={accent} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={24} cy={8} r={4} fill={accent} />
        </>
      )}
    </Svg>
  );
}

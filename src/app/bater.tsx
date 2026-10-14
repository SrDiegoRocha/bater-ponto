import { useLocalSearchParams } from 'expo-router';

import type { DayAction } from '@/domain/state-machine';
import { RetroPunch } from '@/screens/retro-punch';

export default function RetroPunchRoute() {
  const { action } = useLocalSearchParams<{ action?: DayAction }>();
  return <RetroPunch initialAction={action} />;
}

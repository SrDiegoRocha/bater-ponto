import { useLocalSearchParams } from 'expo-router';

import type { DayAction } from '@/domain/state-machine';
import { PunchEntry } from '@/screens/punch-entry';

export default function PunchEntryRoute() {
  const { action } = useLocalSearchParams<{ action?: DayAction }>();
  return <PunchEntry initialAction={action} />;
}

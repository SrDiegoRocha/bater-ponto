import { useLocalSearchParams } from 'expo-router';

import { DayOffSheet } from '@/screens/day-off-sheet';

export default function DayOffRoute() {
  const { dates } = useLocalSearchParams<{ dates: string }>();
  return <DayOffSheet dates={(dates ?? '').split(',').filter(Boolean)} />;
}

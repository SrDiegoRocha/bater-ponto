import { useLocalSearchParams } from 'expo-router';

import { DayCheckScreen } from '@/screens/day-check';

export default function DayCheckRoute() {
  const { date } = useLocalSearchParams<{ date: string }>();
  return <DayCheckScreen date={date} />;
}

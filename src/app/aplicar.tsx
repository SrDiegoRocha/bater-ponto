import { useLocalSearchParams } from 'expo-router';

import { ApplySheet } from '@/screens/apply-sheet';

export default function ApplyRoute() {
  const { dates } = useLocalSearchParams<{ dates: string }>();
  return <ApplySheet dates={(dates ?? '').split(',').filter(Boolean)} />;
}

import { useLocalSearchParams } from 'expo-router';

import { ShiftWorkdaySheet } from '@/screens/shift-workday-sheet';

export default function ShiftWorkdayRoute() {
  const { workdayId } = useLocalSearchParams<{ workdayId: string }>();
  return <ShiftWorkdaySheet workdayId={workdayId} />;
}

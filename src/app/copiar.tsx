import { useLocalSearchParams } from 'expo-router';

import { CopyWorkdaySheet } from '@/screens/copy-workday-sheet';

export default function CopyWorkdayRoute() {
  const { workdayId } = useLocalSearchParams<{ workdayId: string }>();
  return <CopyWorkdaySheet workdayId={workdayId} />;
}

import { useLocalSearchParams } from 'expo-router';

import { WorkdayDetail } from '@/screens/workday-detail';

export default function WorkdayRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <WorkdayDetail workdayId={id} />;
}

import { useLocalSearchParams } from 'expo-router';

import { AddPunches } from '@/screens/add-punches';

export default function AddPunchesRoute() {
  const { workdayId } = useLocalSearchParams<{ workdayId: string }>();
  return <AddPunches workdayId={workdayId} />;
}

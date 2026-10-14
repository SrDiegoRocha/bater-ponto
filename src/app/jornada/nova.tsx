import { useLocalSearchParams } from 'expo-router';

import { NewWorkday } from '@/screens/new-workday';

export default function NewWorkdayRoute() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  return <NewWorkday initialDate={date} />;
}

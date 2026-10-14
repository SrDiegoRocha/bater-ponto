import { useLocalSearchParams } from 'expo-router';

import { PunchEditor } from '@/screens/punch-editor';

export default function PunchEditorRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PunchEditor punchId={id} />;
}

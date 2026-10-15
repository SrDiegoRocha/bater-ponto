import { useLocalSearchParams } from 'expo-router';

import { TemplateEditor } from '@/screens/templates';

export default function TemplateEditorRoute() {
  const { id, fromWorkday } = useLocalSearchParams<{ id?: string; fromWorkday?: string }>();
  return <TemplateEditor id={id} fromWorkday={fromWorkday} />;
}

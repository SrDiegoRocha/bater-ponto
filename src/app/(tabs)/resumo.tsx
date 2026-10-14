import { EmptyState, Screen } from '@/components/ui';

export default function ResumoRoute() {
  return (
    <Screen title="Resumo">
      <EmptyState title="Chega na fase 1" description="Horas, intervalos, folgas e banco de horas do período." />
    </Screen>
  );
}

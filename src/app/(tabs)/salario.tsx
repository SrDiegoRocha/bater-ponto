import { EmptyState, Screen } from '@/components/ui';

export default function SalarioRoute() {
  return (
    <Screen title="Salário">
      <EmptyState title="Chega na fase 1" description="Calcule seu salário a partir das horas do período." />
    </Screen>
  );
}

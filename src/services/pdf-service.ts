import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { buildTimesheetHtml, type TimesheetInput } from '@/lib/timesheet-html';

// Gera o PDF do espelho de ponto no aparelho e abre o compartilhamento do Android (§3.8).

export async function shareTimesheetPdf(input: TimesheetInput): Promise<void> {
  const html = buildTimesheetHtml(input);
  // A4 em pontos (72 dpi)
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });

  // E5: nome legível do arquivo
  const named = new File(Paths.cache, `ponto_${input.period.start}_a_${input.period.end}.pdf`);
  if (named.exists) named.delete();
  new File(uri).move(named);

  await Sharing.shareAsync(named.uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Compartilhar espelho de ponto',
  });
}

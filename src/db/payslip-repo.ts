import type { SQLiteDatabase } from 'expo-sqlite';

import { EMPTY_PAYSLIP, type Payslip, type PayslipValues } from '@/domain/payslip';
import type { Period } from '@/domain/period';

// Holerites conferidos, um por período (chave = início do período).

type Row = { period_start: string; period_end: string; data: string; updated_at: number };

const toPayslip = (r: Row): Payslip => ({
  ...EMPTY_PAYSLIP,
  ...(JSON.parse(r.data) as Partial<PayslipValues>),
  periodStart: r.period_start,
  periodEnd: r.period_end,
  updatedAt: r.updated_at,
});

export async function getPayslip(db: SQLiteDatabase, period: Period): Promise<Payslip | null> {
  const row = await db.getFirstAsync<Row>('SELECT * FROM payslip WHERE period_start = ?', period.start);
  return row ? toPayslip(row) : null;
}

export async function listPayslips(db: SQLiteDatabase): Promise<Payslip[]> {
  const rows = await db.getAllAsync<Row>('SELECT * FROM payslip ORDER BY period_start');
  return rows.map(toPayslip);
}

export async function savePayslip(db: SQLiteDatabase, period: Period, values: PayslipValues): Promise<void> {
  await db.runAsync(
    `INSERT INTO payslip (period_start, period_end, data, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(period_start) DO UPDATE SET period_end = excluded.period_end, data = excluded.data, updated_at = excluded.updated_at`,
    period.start,
    period.end,
    JSON.stringify(values),
    Date.now(),
  );
}

export async function deletePayslip(db: SQLiteDatabase, period: Period): Promise<void> {
  await db.runAsync('DELETE FROM payslip WHERE period_start = ?', period.start);
}

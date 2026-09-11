import { parseDateString } from './dateUtils';

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(val: number): string {
  return new Intl.NumberFormat('ja-JP').format(val);
}

export function formatDate(dateString: string): string {
  if (!dateString) return '-';
  const parts = dateString.split('-');
  if (parts.length === 3) {
    return `${parts[0]}年${parseInt(parts[1], 10)}月${parseInt(parts[2], 10)}日`;
  }
  return dateString;
}

export function formatYearMonth(yearMonth: string): string {
  if (!yearMonth) return '-';
  const parts = yearMonth.split('-');
  if (parts.length === 2) {
    return `${parts[0]}年${parseInt(parts[1], 10)}月`;
  }
  return yearMonth;
}

export function calculateAge(birthDateStr?: string): number | null {
  if (!birthDateStr) return null;
  const today = new Date();
  const birthDate = parseDateString(birthDateStr);
  if (isNaN(birthDate.getTime())) return null;
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
}

export function getFiscalYear(dateStr: string, startMonth: number = 4): number {
  const d = parseDateString(dateStr);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  return month >= startMonth ? year : year - 1;
}

export function getFiscalYearMonths(fiscalYear: number, startMonth: number = 4): string[] {
  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const m = (startMonth + i - 1) % 12 + 1;
    const y = startMonth + i > 12 ? fiscalYear + 1 : fiscalYear;
    months.push(`${y}-${String(m).padStart(2, '0')}`);
  }
  return months;
}

export function downloadCsv(filename: string, csvContent: string) {
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]); // UTF-8 BOM for Excel in Japanese
  const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

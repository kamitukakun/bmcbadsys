export function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateString(str: string): Date {
  const [year, month, day] = str.split('-').map(Number);
  // month is 0-indexed in Date constructor
  return new Date(year, month - 1, day);
}

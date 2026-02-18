export function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

export function addDays(dateString: string, days: number): string {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

export function formatDateGerman(dateString: string): string {
  return new Date(dateString).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function formatDateShort(dateString: string): string {
  return new Date(dateString).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'short',
  });
}

export function isToday(dateString: string): boolean {
  return dateString === getTodayString();
}

export function isPast(dateString: string): boolean {
  return dateString < getTodayString();
}

export function isFuture(dateString: string): boolean {
  return dateString > getTodayString();
}

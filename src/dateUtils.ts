export const toDayKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const dayKeyToDate = (dayKey: string): Date => {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const startOfDay = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

export const formatWeekday = (date: Date): string =>
  date.toLocaleDateString(undefined, { weekday: 'short' });

export const formatMonthDay = (date: Date): string =>
  date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export const formatDateRange = (start: Date, end: Date): string => {
  const startLabel = formatMonthDay(start);
  if (toDayKey(start) === toDayKey(end)) return `${startLabel}, ${start.getFullYear()}`;
  const sameMonth = start.getMonth() === end.getMonth();
  const endLabel = sameMonth ? String(end.getDate()) : formatMonthDay(end);
  return `${startLabel} – ${endLabel}, ${end.getFullYear()}`;
};

export const msToMinutes = (ms: number | undefined | null): number =>
  ms ? Math.round(ms / 60000) : 0;

export const formatDuration = (minutes: number): string => {
  if (minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

export const formatClock = (date: Date): string =>
  date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

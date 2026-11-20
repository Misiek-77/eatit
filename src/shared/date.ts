/** Local calendar day as "2026-03-09". Days follow the device's time zone, not UTC. */
export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The day `days` away from the day key `key` ("2026-03-09", -1 → "2026-03-08"). */
export function shiftDay(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + days));
}

/** Noon of the day key, as a Date: safe to format without slipping to a neighbouring day. */
export function dateOfKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

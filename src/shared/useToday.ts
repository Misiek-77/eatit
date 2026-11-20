import { useEffect, useState } from 'react';
import { dayKey } from './date';

/** Milliseconds from `now` to the next local midnight, plus a moment so the new day has surely begun. */
export function msUntilNextDay(now: Date): number {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return midnight.getTime() - now.getTime() + 1000;
}

/**
 * The current moment, refreshed whenever the day changes: at midnight, and when the app comes back to the
 * foreground. An iPhone keeps a home screen app alive for days, so a date taken once when a screen opened would
 * go stale ("today" stuck on an old day, today's date not selectable). Within one day the value stays the same,
 * so memoised calculations that depend on it are not redone on every render.
 */
export function useToday(): Date {
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    const refresh = () => {
      const now = new Date();
      setToday((current) => (dayKey(current) === dayKey(now) ? current : now));
    };
    const timer = setTimeout(refresh, msUntilNextDay(today));
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refresh);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refresh);
    };
  }, [today]);

  return today;
}

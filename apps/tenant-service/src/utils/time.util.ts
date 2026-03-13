/**
 * Lightweight 24-hr time helpers used by the Period cascade logic.
 * All times are represented as "HH:MM" strings (5-char, zero-padded).
 */

/** Convert "HH:MM" → integer minutes since midnight. */
export function timeToMins(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Convert integer minutes → zero-padded "HH:MM" (wraps at 24 hrs). */
export function minsToTime(mins: number): string {
  const wrapped = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Shift a "HH:MM" string forward (or backward) by `delta` minutes. */
export function addMins(hhmm: string, delta: number): string {
  return minsToTime(timeToMins(hhmm) + delta);
}

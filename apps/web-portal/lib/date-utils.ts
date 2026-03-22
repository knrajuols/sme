/**
 * Timezone-safe date formatting for HTML <input type="date"> fields.
 *
 * Prisma stores DateTimes in UTC. A naive `.slice(0, 10)` on the ISO string
 * can shift the date backwards by one day for users in UTC+ timezones (e.g. IST).
 * This utility parses the date into the **local** timezone before formatting.
 */
export function formatDateForInput(dateInput?: string | Date | null): string {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

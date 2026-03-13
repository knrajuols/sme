const COLOR_MAP: Record<string, string> = {
  // Green — positive / active
  PRESENT:   'bg-green-50 text-green-700',
  ACTIVE:    'bg-green-50 text-green-700',
  PASS:      'bg-green-50 text-green-700',
  PUBLISHED: 'bg-green-50 text-green-700',
  GRADUATED: 'bg-green-50 text-green-700',
  COMPLETED: 'bg-green-50 text-green-700',
  // Red — negative / inactive
  ABSENT:      'bg-red-50 text-red-700',
  INACTIVE:    'bg-red-50 text-red-700',
  FAIL:        'bg-red-50 text-red-700',
  DROPPED_OUT: 'bg-red-50 text-red-700',
  CANCELLED:   'bg-red-50 text-red-700',
  // Yellow — transitional
  LATE:        'bg-yellow-50 text-yellow-700',
  PENDING:     'bg-yellow-50 text-yellow-700',
  TRANSFERRED: 'bg-yellow-50 text-yellow-700',
  VERIFIED:    'bg-yellow-50 text-yellow-700',
  // Blue — in-progress
  ONGOING: 'bg-blue-50 text-blue-700',
  // Gray — neutral / draft
  DRAFT: 'bg-slate-100 text-slate-500',
};

export function StatusPill({ status }: { status: string }) {
  const colorClass = COLOR_MAP[status] ?? 'bg-blue-50 text-blue-700';
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${colorClass}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

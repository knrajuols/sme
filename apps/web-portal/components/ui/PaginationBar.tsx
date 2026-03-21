// Issue-250: Shared pagination component used across Students and Parents tables.
// Renders first/prev/numbered/next/last controls with ellipsis for large page counts.
'use client';

interface PaginationBarProps {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}

export function PaginationBar({ page, totalPages, onPage }: PaginationBarProps) {
  if (totalPages <= 1) return null;

  const btnCls = (active: boolean, disabled: boolean) =>
    [
      'min-w-[32px] h-8 rounded-lg px-1.5 text-xs font-medium transition-colors',
      'disabled:opacity-40 disabled:cursor-not-allowed',
      active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100',
    ].join(' ');

  // Show up to 7 consecutive page numbers centred around current page.
  const rangeStart = Math.max(1, Math.min(page - 3, totalPages - 6));
  const rangeEnd   = Math.min(totalPages, rangeStart + 6);
  const pageNums   = Array.from({ length: rangeEnd - rangeStart + 1 }, (_, i) => rangeStart + i);

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onPage(1)}
        disabled={page === 1}
        className={btnCls(false, page === 1)}
        aria-label="First page"
      >«</button>
      <button
        type="button"
        onClick={() => onPage(page - 1)}
        disabled={page === 1}
        className={btnCls(false, page === 1)}
        aria-label="Previous page"
      >‹</button>

      {rangeStart > 1 && <span className="px-1 text-slate-300 text-xs">…</span>}

      {pageNums.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPage(p)}
          className={btnCls(p === page, false)}
          aria-label={`Page ${p}`}
          aria-current={p === page ? 'page' : undefined}
        >
          {p}
        </button>
      ))}

      {rangeEnd < totalPages && <span className="px-1 text-slate-300 text-xs">…</span>}

      <button
        type="button"
        onClick={() => onPage(page + 1)}
        disabled={page === totalPages}
        className={btnCls(false, page === totalPages)}
        aria-label="Next page"
      >›</button>
      <button
        type="button"
        onClick={() => onPage(totalPages)}
        disabled={page === totalPages}
        className={btnCls(false, page === totalPages)}
        aria-label="Last page"
      >»</button>
    </div>
  );
}

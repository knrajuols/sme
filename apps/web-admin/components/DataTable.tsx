import { ReactNode } from 'react';

export interface TableColumn<T> {
  key: keyof T | string;
  label: string;
  render?: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  loading?: boolean;
  filters?: ReactNode;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  loading,
  filters,
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: DataTableProps<T>) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {filters && (
        <div className="sticky top-0 z-10 bg-slate-50/80 backdrop-blur-sm px-5 py-3 border-b border-slate-200">
          {filters}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-10 text-center text-sm text-slate-400">
                  Loading…
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-10 text-center text-sm text-slate-400">
                  No records found
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={row.id}
                  className="group border-b border-slate-100 even:bg-slate-50/30 hover:bg-blue-50/50 transition-colors duration-150"
                >
                  {columns.map((col) => (
                    <td
                      key={String(col.key)}
                      className="px-6 py-4 text-sm text-slate-700 group-hover:text-slate-900"
                    >
                      {col.render ? col.render(row) : (row[col.key as keyof T] as ReactNode)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50/60">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 font-medium">Rows</label>
          <select
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {[10, 20, 50].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            ← Prev
          </button>
          <span className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md">
            {page} / {totalPages}
          </span>
          <button
            className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            Next →
          </button>
        </div>
        <p className="text-xs text-slate-400">{total} total</p>
      </div>
    </div>
  );
}


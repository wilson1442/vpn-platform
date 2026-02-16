'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  hideOnMobile?: boolean;
  sortable?: boolean;
  sortValue?: (item: T) => string | number;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  searchable?: boolean;
  searchKeys?: string[];
  searchPlaceholder?: string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  onRowClick,
  searchable = false,
  searchKeys,
  searchPlaceholder,
}: DataTableProps<T>) {
  const hasHiddenColumns = columns.some((col) => col.hideOnMobile);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (col: Column<T>) => {
    if (!col.sortable) return;
    if (sortKey === col.key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(col.key);
      setSortDir('asc');
    }
  };

  const processed = useMemo(() => {
    let result = data;

    // Search filter
    if (searchable && search.trim()) {
      const q = search.toLowerCase();
      const keys = searchKeys || columns.filter((c) => c.key !== 'actions').map((c) => c.key);
      result = result.filter((item) =>
        keys.some((key) => {
          const val = item[key];
          if (val == null) return false;
          if (typeof val === 'string') return val.toLowerCase().includes(q);
          if (typeof val === 'number') return String(val).includes(q);
          // Check nested objects (e.g. user.email, reseller.companyName, entitlement.package.name)
          if (typeof val === 'object') return JSON.stringify(val).toLowerCase().includes(q);
          return false;
        }),
      );
    }

    // Sort
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      if (col?.sortable) {
        result = [...result].sort((a, b) => {
          let aVal: string | number;
          let bVal: string | number;

          if (col.sortValue) {
            aVal = col.sortValue(a);
            bVal = col.sortValue(b);
          } else {
            aVal = a[col.key] ?? '';
            bVal = b[col.key] ?? '';
          }

          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
          }
          const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true, sensitivity: 'base' });
          return sortDir === 'asc' ? cmp : -cmp;
        });
      }
    }

    return result;
  }, [data, search, searchable, searchKeys, sortKey, sortDir, columns]);

  return (
    <div className="space-y-2">
      {searchable && (
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder || 'Search...'}
            className="w-full rounded-lg border border-border/30 bg-card/40 py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40 backdrop-blur-sm transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-border/40">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground',
                    col.hideOnMobile && 'hidden md:table-cell',
                    col.sortable && 'cursor-pointer select-none hover:text-foreground transition-colors',
                  )}
                  onClick={() => handleSort(col)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      <span className="inline-flex flex-col leading-none -space-y-0.5">
                        <svg
                          className={cn('h-3 w-3', sortKey === col.key && sortDir === 'asc' ? 'text-cyan-400' : 'text-muted-foreground/30')}
                          viewBox="0 0 12 12"
                          fill="currentColor"
                        >
                          <path d="M6 2l4 4H2z" />
                        </svg>
                        <svg
                          className={cn('h-3 w-3', sortKey === col.key && sortDir === 'desc' ? 'text-cyan-400' : 'text-muted-foreground/30')}
                          viewBox="0 0 12 12"
                          fill="currentColor"
                        >
                          <path d="M6 10l4-4H2z" />
                        </svg>
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {processed.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <svg className="h-8 w-8 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    {search ? 'No matching results' : 'No data found'}
                  </div>
                </td>
              </tr>
            ) : (
              processed.map((item, i) => (
                <tr
                  key={item.id || i}
                  className={cn(
                    'border-b border-border/20 transition-colors duration-150 hover:bg-cyan-500/5',
                    onRowClick && 'cursor-pointer',
                  )}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 py-3.5',
                        col.hideOnMobile && 'hidden md:table-cell',
                      )}
                    >
                      {col.render ? col.render(item) : String(item[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {hasHiddenColumns && (
        <p className="text-xs text-muted-foreground/60 md:hidden">
          Swipe to see more columns
        </p>
      )}
    </div>
  );
}

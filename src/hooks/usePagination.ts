import { useMemo, useState } from 'react';
import { paginationRange } from '../utils/pagination';

export function usePagination<T>(items: T[], filterKey: string, initialSize = 25) {
  const [selection, setSelection] = useState({ key: filterKey, page: 1, size: initialSize });
  const range = paginationRange(items.length, selection.key === filterKey ? selection.page : 1, selection.size);
  if (selection.key !== filterKey || selection.page !== range.page) {
    setSelection({ ...selection, key: filterKey, page: range.page });
  }
  const visibleItems = useMemo(() => items.slice(range.start, range.end), [items, range.start, range.end]);
  return {
    ...range,
    items: visibleItems,
    total: items.length,
    pageSize: selection.size,
    onPageChange: (page: number) => setSelection({ key: filterKey, page, size: selection.size }),
    onPageSizeChange: (size: number) => setSelection({ key: filterKey, page: 1, size }),
  };
}

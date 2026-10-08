import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface Props {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  start: number;
  end: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function Pagination({ page, totalPages, total, pageSize, start, end, onPageChange, onPageSizeChange }: Props) {
  return (
    <nav aria-label="Paginación de resultados" className="wt-pagination">
      <p role="status" className="text-xs text-slate-500">
        <strong className="font-semibold text-slate-800">{total ? start + 1 : 0}–{end}</strong> de {total.toLocaleString('es-CO')} resultados
      </p>
      <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-start">
        <label className="flex items-center gap-2 text-xs text-slate-500">
          Por página
          <select aria-label="Resultados por página" value={pageSize} onChange={event => onPageSizeChange(Number(event.target.value))} className="!w-auto !py-1.5 !text-xs">
            {[25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-1 sm:gap-2">
        <button type="button" className="btn-secondary !hidden sm:!inline-flex !p-2" disabled={page <= 1} onClick={() => onPageChange(1)} aria-label="Primera página"><ChevronsLeft className="h-4 w-4" /></button>
        <button type="button" className="btn-secondary !p-2" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Página anterior"><ChevronLeft className="h-4 w-4" /></button>
        <span className="min-w-12 sm:min-w-20 text-center text-xs font-semibold tabular-nums">{page} / {totalPages}</span>
        <button type="button" className="btn-secondary !p-2" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Página siguiente"><ChevronRight className="h-4 w-4" /></button>
        <button type="button" className="btn-secondary !hidden sm:!inline-flex !p-2" disabled={page >= totalPages} onClick={() => onPageChange(totalPages)} aria-label="Última página"><ChevronsRight className="h-4 w-4" /></button>
        </div>
      </div>
    </nav>
  );
}

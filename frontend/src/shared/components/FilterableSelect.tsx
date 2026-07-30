import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

/**
 * FilterableSelect — combobox con lista dropdown filtrable por nombre.
 *
 * Caso de uso: listas largas (p. ej. todos los distritos del Perú) donde un
 * <select> nativo es lento/imposible de navegar. Renderiza un input que al
 * enfocarse despliega la lista; al escribir filtra case-insensitive por la
 * etiqueta visible. Soporta placeholder, value/label controlados y opción
 * vacía ("sin selección").
 *
 * No busca server-side: filtra en cliente sobre las `options` recibidas
 * (lo suficientemente rápida para la cardinalidad usada).
 */

export interface FilterableOption {
  value: string;
  label: string;
}

interface FilterableSelectProps {
  value: string;
  onChange: (v: string) => void;
  options: FilterableOption[];
  placeholder?: string;
  /** Texto del campo vacío cuando no hay value seleccionado. */
  emptyLabel?: string;
  /** Ancho mínimo del dropdown (Tailwind class). Por defecto 'min-w-64'. */
  dropdownMinWidth?: string;
  /** Si true, el control está deshabilitado. */
  disabled?: boolean;
}

export function FilterableSelect({
  value,
  onChange,
  options,
  placeholder = 'Buscar…',
  emptyLabel = '— Sin selección —',
  dropdownMinWidth = 'min-w-64',
  disabled = false,
}: FilterableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  // Cerrar al clic fuera.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // Reset del filtro al cerrar.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- limpia el texto del
       buscador cuando el dropdown se cierra (sincronización UI <> estado). */
    if (!open) setQuery('');
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open]);

  // Enfocar el input al abrir.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function handleSelect(v: string) {
    onChange(v);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full px-4 py-2.5 rounded-xl outline outline-1 outline-offset-[-1px] outline-button-stroke',
          'text-sm font-sans bg-background-main flex items-center justify-between gap-2',
          !selected ? 'text-text-secondary' : 'text-text-primary',
          'focus:outline-2 focus:outline-primary-main',
          disabled && 'opacity-60 cursor-not-allowed',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate text-left">
          {selected ? selected.label : emptyLabel}
        </span>
        <ChevronDown
          className="size-4 text-icon-main shrink-0"
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          className={cn(
            'absolute z-50 mt-1 bg-background-main rounded-xl outline outline-1 outline-offset-[-1px] outline-button-stroke shadow-lg',
            'flex flex-col max-h-72 w-full',
            dropdownMinWidth,
          )}
          role="listbox"
        >
          {/* Input de búsqueda */}
          <div className="relative p-2 border-b border-button-stroke">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-icon-main pointer-events-none"
              strokeWidth={2}
              aria-hidden="true"
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full pl-9 pr-7 py-1.5 rounded-lg outline outline-1 outline-offset-[-1px] outline-button-stroke
                         text-sm font-sans bg-background-main text-text-primary
                         focus:outline-2 focus:outline-primary-main"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-secondary hover:text-text-primary"
                aria-label="Limpiar filtro"
              >
                <X className="size-3.5" strokeWidth={2} aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Lista (scrollable) */}
          <div className="overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={cn(
                'w-full text-left px-4 py-2 text-sm font-sans transition-colors',
                value === ''
                  ? 'bg-primary-states-hover-main/40 text-primary-main font-medium'
                  : 'text-text-primary hover:bg-primary-states-hover-main/30',
              )}
            >
              {emptyLabel}
            </button>
            {filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => handleSelect(o.value)}
                className={cn(
                  'w-full text-left px-4 py-2 text-sm font-sans transition-colors',
                  o.value === value
                    ? 'bg-primary-states-hover-main/40 text-primary-main font-medium'
                    : 'text-text-primary hover:bg-primary-states-hover-main/30',
                )}
              >
                {o.label}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-4 py-3 text-sm font-sans text-text-secondary">
                Sin resultados
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helper: wrap un Field con label idéntico al de EditorUmbral ──────────
export function FilterableField({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-text-primary text-sm font-medium font-sans">
        {label}
        {required && <span className="text-secondary-main"> *</span>}
      </label>
      {children}
    </div>
  );
}
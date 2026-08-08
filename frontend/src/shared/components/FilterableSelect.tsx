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

interface FilterableSelectBaseProps {
  options: FilterableOption[];
  placeholder?: string;
  /** Ancho mínimo del dropdown (Tailwind class). Por defecto 'min-w-64'. */
  dropdownMinWidth?: string;
  /** Si true, el control está deshabilitado. */
  disabled?: boolean;
}

interface FilterableSelectSingleProps extends FilterableSelectBaseProps {
  /** Modo multi desactivado (default). */
  multiselect?: false;
  value: string;
  onChange: (v: string) => void;
  /** Texto del campo vacío cuando no hay value seleccionado (modo single). */
  emptyLabel?: string;
}

interface FilterableSelectMultiProps extends FilterableSelectBaseProps {
  /** Modo multi activado: selección múltiple con checks. */
  multiselect: true;
  value: string[];
  onChange: (v: string[]) => void;
  /** Texto del campo cuando ningún item está seleccionado (modo multi). */
  emptyLabel?: string;
  /** Texto del campo cuando TODOS los items están seleccionados. */
  allLabel?: string;
}

type FilterableSelectProps =
  | FilterableSelectSingleProps
  | FilterableSelectMultiProps;

export function FilterableSelect(props: FilterableSelectProps) {
  const {
    options,
    placeholder = 'Buscar…',
    emptyLabel = '— Sin selección —',
    dropdownMinWidth = 'min-w-64',
    disabled = false,
  } = props;

  if (props.multiselect) {
    return (
      <FilterableSelectMulti
        options={options}
        value={props.value}
        onChange={props.onChange}
        placeholder={placeholder}
        emptyLabel={emptyLabel}
        allLabel={props.allLabel}
        dropdownMinWidth={dropdownMinWidth}
        disabled={disabled}
      />
    );
  }
  return (
    <FilterableSelectSingle
      options={options}
      value={props.value}
      onChange={props.onChange}
      placeholder={placeholder}
      emptyLabel={emptyLabel}
      dropdownMinWidth={dropdownMinWidth}
      disabled={disabled}
    />
  );
}

/** Implementación modo single (comportamiento histórico, sin cambios). */
function FilterableSelectSingle({
  value,
  onChange,
  options,
  placeholder,
  emptyLabel,
  dropdownMinWidth,
  disabled,
}: Required<
  Omit<FilterableSelectSingleProps, 'multiselect'>
>) {
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

/**
 * Implementación modo multi: el trigger muestra un texto condensado en una
 * sola línea (igual que el modo single) — "— Todos —" cuando no hay nada,
 * `allLabel` cuando están TODOS, "PrimerLabel · +N más" cuando hay varios
 * pero no todos, y la etiqueta del único seleccionado cuando es solo uno.
 *
 * El dropdown marca cada opción con un check; tildar/destildar no cierra
 * el dropdown (permite elegir varias de una sola apertura). Incluye una
 * acción "Seleccionar todo" / "Quitar todos" para listas largas.
 */
function FilterableSelectMulti({
  value,
  onChange,
  options,
  placeholder,
  emptyLabel,
  allLabel,
  dropdownMinWidth,
  disabled,
}: Omit<FilterableSelectMultiProps, 'multiselect'>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedSet = new Set(value);
  const selectedOptions = options.filter((o) => selectedSet.has(o.value));
  const allSelected = selectedOptions.length === options.length;

  /** Texto condensado del trigger: "— Todos —" / "Todos" / "X · +N más". */
  const triggerLabel = (() => {
    if (selectedOptions.length === 0) return emptyLabel;
    if (allSelected) return allLabel;
    if (selectedOptions.length === 1) return selectedOptions[0].label;
    return `${selectedOptions[0].label} · +${selectedOptions.length - 1} más`;
  })();

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

  function toggle(v: string) {
    if (selectedSet.has(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  }

  function toggleAll() {
    onChange(allSelected ? [] : options.map((o) => o.value));
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
          selectedOptions.length === 0 ? 'text-text-secondary' : 'text-text-primary',
          'focus:outline-2 focus:outline-primary-main',
          disabled && 'opacity-60 cursor-not-allowed',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate text-left">{triggerLabel}</span>
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

          {/* Acción "Seleccionar todo" */}
          <button
            type="button"
            onClick={toggleAll}
            className="w-full text-left px-4 py-2 text-xs font-sans font-semibold
                       text-primary-main border-b border-button-stroke
                       hover:bg-primary-states-hover-main/30 transition-colors"
          >
            {allSelected ? 'Quitar todos' : 'Seleccionar todos'}
          </button>

          {/* Lista (scrollable) con checks */}
          <div className="overflow-y-auto py-1">
            {filtered.map((o) => {
              const isOn = selectedSet.has(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => toggle(o.value)}
                  className={cn(
                    'w-full text-left px-4 py-2 text-sm font-sans transition-colors',
                    'inline-flex items-center gap-2',
                    isOn
                      ? 'bg-primary-states-hover-main/40 text-primary-main font-medium'
                      : 'text-text-primary hover:bg-primary-states-hover-main/30',
                  )}
                >
                  <span
                    className={cn(
                      'size-4 inline-flex items-center justify-center shrink-0 rounded border',
                      isOn
                        ? 'bg-primary-main border-primary-main text-text-invert-primary'
                        : 'border-button-stroke bg-background-main',
                    )}
                  >
                    {isOn && (
                      <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
                        <path
                          d="M2.5 6L5 8.5L9.5 3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.67"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                  {o.label}
                </button>
              );
            })}
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
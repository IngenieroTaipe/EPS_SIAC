import type { Componente } from '@/features/mapa/types/componente';
import { ComponentRow, type ComponentRowVariant } from './ComponentRow';

/**
 * ComponentsTable — tabla minimalista de componentes (gestión).
 *
 * Diseño:
 *   - Header **sólido navy** `bg-primary-main` con texto blanco, sin
 *     outline grueso (más elegante). Separador entre header y filas
 *     hairline `border-input-stroke-main`.
 *   - Filas en blanco con hover sutil. Clic en la fila abre el sheet
 *     (variante `gestion`).
 *   - Borde redondeado `rounded-xl` (era `rounded-[10px]`).
 *
 * Columnas (en orden):
 *   Código | Unidad Operativa | Nombre | Tipo | Especificación
 *   | Este UTM | Norte UTM | Estado | Criticidad | Acciones
 *
 * Variantes:
 *   - `gestion` (default): clic en fila abre sheet; solo botón Editar.
 *   - `mapa` (legacy): toggle selección; sin apertura de sheet.
 */
interface ComponentsTableProps {
  componentes: Componente[];
  /** ID de la fila resaltada (seleccionada en el sheet). */
  selectedId: string | null;
  /** Toggle selección (variante `mapa`). */
  onToggleSelect?: (id: string) => void;
  /** Abrir el sheet al clic en fila (variante `gestion`). */
  onOpenDetail?: (componente: Componente) => void;
  /** Si true (default), el row seleccionado se mueve al inicio. */
  sortSelectedFirst?: boolean;
  /** Anchura fija de celdas (recomendado en gestión con scroll x). */
  fixedWidths?: boolean;
  /** Variante. Default `gestion`. */
  variant?: ComponentRowVariant;
}

const HEADER_COLS = [
  { label: 'Código', width: 'w-28' },
  { label: 'Unidad Operativa', width: 'w-40' },
  { label: 'Nombre', width: 'w-56' },
  { label: 'Tipo', width: 'w-48' },
  { label: 'Especificación', width: 'w-56' },
  { label: 'Este UTM', width: 'w-32' },
  { label: 'Norte UTM', width: 'w-32' },
  { label: 'Estado Op.', width: 'w-32' },
  { label: 'Estado Fís.', width: 'w-32' },
  { label: 'Criticidad', width: 'w-28' },
  { label: '', width: 'w-20' },
] as const;

export function ComponentsTable({
  componentes,
  selectedId,
  onToggleSelect,
  onOpenDetail,
  sortSelectedFirst = true,
  fixedWidths = true,
  variant = 'gestion',
}: ComponentsTableProps) {
  // Ordenar: si hay seleccionado y sortSelectedFirst, ese va primero.
  const ordered = sortSelectedFirst && selectedId
    ? [
        ...componentes.filter((c) => c.id === selectedId),
        ...componentes.filter((c) => c.id !== selectedId),
      ]
    : componentes;

  return (
    <div className="self-stretch flex flex-col">
      {/* Header sólido navy — sticky para que se mantenga al hacer scroll */}
      <div className="inline-flex items-stretch bg-primary-main sticky top-0 z-10">
        {HEADER_COLS.map((col) => (
          <div
            key={col.label || 'acciones'}
            className={`${col.width} h-10 px-3 py-2 inline-flex items-center`}
          >
            <span className="text-text-invert-primary text-xs font-bold font-sans uppercase tracking-wide">
              {col.label}
            </span>
          </div>
        ))}
      </div>

      {/* Filas */}
      {ordered.map((c) => (
        <ComponentRow
          key={c.id}
          componente={c}
          selected={selectedId === c.id}
          onToggleSelect={onToggleSelect}
          onOpenDetail={onOpenDetail}
          fixedWidths={fixedWidths}
          variant={variant}
        />
      ))}
    </div>
  );
}
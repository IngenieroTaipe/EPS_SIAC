import type { AlertaHistorica } from '../types';
import { AlertaRow, type AlertaRowVariant } from './AlertaRow';

/**
 * AlertsTable — tabla minimalista de alertas (gestión).
 *
 * Diseño alineado con `ComponentsTable`:
 *   - Header **sólido navy** `bg-primary-main` con texto blanco, sin
 *     outline grueso. Separador entre header y filas hairline
 *     `border-input-stroke-main`. Header sticky para que se mantenga al
 *     hacer scroll vertical.
 *   - Filas en blanco con hover sutil. Clic en la fila abre el sheet
 *     (variante `gestion`).
 *   - Borde redondeado `rounded-xl`.
 *
 * Columnas (en orden):
 *   Código | Fen. Climático | Fecha/hora predicción | Unidad Operativa
 *   | Umbral | Estado o fase | Acciones
 *
 * Variantes:
 *   - `gestion` (default): clic en fila abre el sheet; el botón Editar
 *     navega a `/alertas/:id/editar`.
 *   - `mapa`: toggle selección (resaltado en el mapa); fila con botones
 *     view + edit (legacy, usado por `MapAlertsPanel`).
 */
interface AlertsTableProps {
  alertas: AlertaHistorica[];
  /** ID de la fila resaltada (seleccionada en el sheet o en el mapa). */
  selectedId: string | null;
  /** Toggle selección (variante `mapa`). */
  onToggleSelect?: (id: string) => void;
  /** Abrir el sheet al clic en fila (variante `gestion`). */
  onOpenDetail?: (alerta: AlertaHistorica) => void;
  /** Si true (default), el row seleccionado se mueve al inicio. */
  sortSelectedFirst?: boolean;
  /** Si true, el row usa fondo amarillo en selected. Default true. */
  highlightSelected?: boolean;
  /** Anchura fija de celdas (recomendado en gestión con scroll x). */
  fixedWidths?: boolean;
  /** Variante. Default `gestion`. */
  variant?: AlertaRowVariant;
}

const HEADER_COLS = [
  { label: 'Código', width: 'w-32' },
  { label: 'Fen. Climático', width: 'w-44' },
  { label: 'Fecha/hora predicción', width: 'w-56' },
  { label: 'Unidad Operativa', width: 'w-56' },
  { label: 'Umbral', width: 'w-48' },
  { label: 'Estado o fase', width: 'w-44' },
  { label: '', width: 'w-20' },
] as const;

export function AlertsTable({
  alertas,
  selectedId,
  onToggleSelect,
  onOpenDetail,
  sortSelectedFirst = true,
  highlightSelected = true,
  fixedWidths = true,
  variant = 'gestion',
}: AlertsTableProps) {
  // Ordenar: si hay seleccionado y sortSelectedFirst, ese va primero.
  const ordered = sortSelectedFirst && selectedId
    ? [
        ...alertas.filter((a) => a.id === selectedId),
        ...alertas.filter((a) => a.id !== selectedId),
      ]
    : alertas;

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
      {ordered.map((a) => (
        <AlertaRow
          key={a.id}
          alerta={a}
          selected={highlightSelected && selectedId === a.id}
          onToggleSelect={onToggleSelect}
          onOpenDetail={onOpenDetail}
          fixedWidths={fixedWidths}
          variant={variant}
        />
      ))}
    </div>
  );
}
import { cn } from '@/shared/lib/cn';
import type { AlertaHistorica } from '../types';
import { AlertaRow, type AlertaRowVariant } from './AlertaRow';

/**
 * AlertsTable — tabla de alertas (gestión) como tabla HTML real.
 *
 * Estructura idéntica a `ComponentsTable`: `<table>` semántica con
 * `table-fixed` + `<colgroup>`. Los anchos de columna se definen UNA SOLA
 * VEZ en el `<colgroup>`; `<thead>` y `<tbody>` comparten automáticamente
 * los mismos anchos (garantizado por el navegador), por lo que el
 * encabezado y las filas SIEMPRE cuadran — en cualquier viewport o zoom.
 *
 * Diseño:
 *   - Header sólido navy `bg-primary-main` con texto blanco, sticky al
 *     hacer scroll vertical (`sticky top-0`).
 *   - Filas blancas con hover sutil y separadores hairline
 *     `border-input-stroke-main`. Clic en la fila abre el sheet (gestión).
 *   - `border-separate border-spacing-0` para que los borders de las
 *     celdas no se despeguen del header sticky (bug conocido de
 *     border-collapse + sticky en Chrome).
 *   - `min-w` en la tabla = suma de anchos del colgroup: en contenedores
 *     más angostos la tabla NO se comprime, scrollea horizontal como un
 *     solo bloque (header incluido).
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
  /** Si true (default), el row usa fondo amarillo en selected. */
  highlightSelected?: boolean;
  /** Variante. Default `gestion`. */
  variant?: AlertaRowVariant;
}

/** Etiquetas del header (alineadas 1:1 con COL_WIDTHS). */
const HEADER_LABELS = [
  'Código',
  'Fen. Climático',
  'Fecha/hora predicción',
  'Unidad Operativa',
  'Umbral',
  'Estado o fase',
  '',
] as const;

/** Anchos de columna — única fuente de verdad (via <colgroup>). */
const COL_WIDTHS = [
  'w-32', // Código
  'w-44', // Fen. Climático
  'w-56', // Fecha/hora predicción
  'w-56', // Unidad Operativa
  'w-48', // Umbral
  'w-44', // Estado o fase
  'w-20', // Acciones
] as const;

/** Suma de los anchos del colgroup (75rem) — mínimo de la tabla. */
const TABLE_MIN_WIDTH = 'min-w-[75rem]';

export function AlertsTable({
  alertas,
  selectedId,
  onToggleSelect,
  onOpenDetail,
  sortSelectedFirst = true,
  highlightSelected = true,
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
    <table
      className={cn(
        'table-fixed w-full border-separate border-spacing-0',
        TABLE_MIN_WIDTH,
      )}
    >
      {/* Anchos de columna definidos UNA vez: header y filas siempre
          cuadran porque comparten este colgroup. */}
      <colgroup>
        {COL_WIDTHS.map((width, i) => (
          <col key={i} className={width} />
        ))}
      </colgroup>

      {/* Header sólido navy — sticky al scroll vertical del contenedor. */}
      <thead>
        <tr>
          {HEADER_LABELS.map((label, i) => (
            <th
              key={label || `col-${i}`}
              scope="col"
              className="h-10 px-3 py-2 text-left align-middle
                         bg-primary-main sticky top-0 z-10"
            >
              {label && (
                <span className="text-text-invert-primary text-xs font-bold font-sans uppercase tracking-wide">
                  {label}
                </span>
              )}
            </th>
          ))}
        </tr>
      </thead>

      {/* Filas */}
      <tbody>
        {ordered.map((a) => (
          <AlertaRow
            key={a.id}
            alerta={a}
            selected={highlightSelected && selectedId === a.id}
            onToggleSelect={onToggleSelect}
            onOpenDetail={onOpenDetail}
            variant={variant}
          />
        ))}
      </tbody>
    </table>
  );
}

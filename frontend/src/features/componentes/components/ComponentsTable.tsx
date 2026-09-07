import type { Componente } from '@/features/mapa/types/componente';
import { cn } from '@/shared/lib/cn';
import { ComponentRow, type ComponentRowVariant } from './ComponentRow';

/**
 * ComponentsTable — tabla de componentes (gestión) como tabla HTML real.
 *
 * Estructura: `<table>` semántica con `table-fixed` + `<colgroup>`.
 * Los anchos de columna se definen UNA SOLA VEZ en el `<colgroup>`;
 * `<thead>` y `<tbody>` comparten automáticamente los mismos anchos
 * (garantizado por el navegador), por lo que el encabezado y las filas
 * SIEMPRE cuadran — en cualquier viewport o zoom.
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
 *   Código | Unidad Operativa | Nombre | Tipo | Especificación
 *   | Este UTM | Norte UTM | Estado Op. | Estado Fís. | Criticidad | Acciones
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
  /** Variante. Default `gestion`. */
  variant?: ComponentRowVariant;
}

/** Etiquetas del header (alineadas 1:1 con COL_WIDTHS). */
const HEADER_LABELS = [
  'Código',
  'Unidad Operativa',
  'Nombre',
  'Tipo',
  'Especificación',
  'Este UTM',
  'Norte UTM',
  'Estado Op.',
  'Estado Fís.',
  'Criticidad',
  '',
] as const;

/** Anchos de columna — única fuente de verdad (via <colgroup>). */
const COL_WIDTHS = [
  'w-28', // Código
  'w-40', // Unidad Operativa
  'w-56', // Nombre
  'w-48', // Tipo
  'w-56', // Especificación
  'w-32', // Este UTM
  'w-32', // Norte UTM
  'w-32', // Estado Op.
  'w-32', // Estado Fís.
  'w-28', // Criticidad
  'w-20', // Acciones
] as const;

/** Suma de los anchos del colgroup (101rem) — mínimo de la tabla. */
const TABLE_MIN_WIDTH = 'min-w-[101rem]';

export function ComponentsTable({
  componentes,
  selectedId,
  onToggleSelect,
  onOpenDetail,
  sortSelectedFirst = true,
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
        {ordered.map((c) => (
          <ComponentRow
            key={c.id}
            componente={c}
            selected={selectedId === c.id}
            onToggleSelect={onToggleSelect}
            onOpenDetail={onOpenDetail}
            variant={variant}
          />
        ))}
      </tbody>
    </table>
  );
}

import type { Componente } from '@/features/mapa/types/componente';
import { ComponentRow } from './ComponentRow';

/**
 * ComponentsTable — tabla de componentes con header navy (`primary-extraLight`
 * con `text-primary-main` bold) según Figma.
 *
 * Columnas:
 *   Código | Tipo | Especificación | Unidad Operativa | Latitud | Longitud
 *   | Criticidad | (acciones)
 *
 * Usada tanto por el panel deslizable del mapa (`MapComponentsPanel`) como por
 * el histórico filtrable (`HistoricoComponentesPage`). El parámetro
 * `sortSelectedFirst` permite reordenar poniendo la fila seleccionada primero
 * (comportamiento requerido por el usuario).
 */
interface ComponentsTableProps {
  componentes: Componente[];
  selectedId: string | null;
  onToggleSelect: (id: string) => void;
  /** Si true (default), el row seleccionado se mueve al inicio. */
  sortSelectedFirst?: boolean;
  /** Anchura fija de celdas (más útil en histórico con espacio extra). */
  fixedWidths?: boolean;
  /** Si true, muestra la columna "Nombre" (solo en gestión, no en mapa). */
  showNombre?: boolean;
  /**
   * Si true (default), la fila seleccionada se pinta de amarillo. Útil en
   * el panel del mapa; en el histórico se deja en false porque no hay
   * sincronización con el mapa. Paridad con `AlertsTable.highlightSelected`.
   */
  highlightSelected?: boolean;
}

const HEADER_COLS = [
  { label: 'Código', minWidth: 'min-w-24' },
  { label: 'Tipo', minWidth: 'min-w-36' },
  { label: 'Especificación', minWidth: 'min-w-48' },
  { label: 'Unidad Operativa', minWidth: 'min-w-40' },
  { label: 'Latitud', minWidth: 'min-w-28' },
  { label: 'Longitud', minWidth: 'min-w-28' },
  { label: 'Criticidad', minWidth: 'min-w-24' },
];

const NOMBRE_COL = { label: 'Nombre', minWidth: 'min-w-32' };

export function ComponentsTable({
  componentes,
  selectedId,
  onToggleSelect,
  sortSelectedFirst = true,
  fixedWidths = false,
  showNombre = false,
  highlightSelected = true,
}: ComponentsTableProps) {
  // Ordenar: si hay seleccionado y sortSelectedFirst, ese va primero.
  const ordered = sortSelectedFirst && selectedId
    ? [
        ...componentes.filter((c) => c.id === selectedId),
        ...componentes.filter((c) => c.id !== selectedId),
      ]
    : componentes;

  return (
    <div className="self-stretch rounded-[10px] border border-input-stroke-main flex flex-col justify-start items-center gap-0.5 overflow-hidden">
      {/* Header — texto blanco, text-sm */}
      <div className="self-stretch h-12 bg-primary-extra-light rounded-tl-[10px] rounded-tr-[10px] outline outline-1 outline-primary-main inline-flex justify-between items-center">
        {HEADER_COLS.map((col, i) => {
          // Insertar columna "Nombre" después de "Código" (índice 0)
          if (i === 1 && showNombre) {
            return (
              <div key={col.label} className="contents">
                <div className={`flex-1 h-12 ${NOMBRE_COL.minWidth} px-3 py-2 bg-primary-extra-light flex justify-center items-center gap-2`}>
                  <span className="text-text-invert-primary text-sm font-semibold font-sans">{NOMBRE_COL.label}</span>
                </div>
                <div className={`flex-1 h-12 ${col.minWidth} px-3 py-2 bg-primary-extra-light flex justify-center items-center gap-2`}>
                  <span className="text-text-invert-primary text-sm font-semibold font-sans">{col.label}</span>
                </div>
              </div>
            );
          }
          return (
            <div
              key={col.label}
              className={`flex-1 h-12 ${col.minWidth} px-3 py-2 bg-primary-extra-light flex justify-center items-center gap-2`}
            >
              <span className="text-text-invert-primary text-sm font-semibold font-sans">
                {col.label}
              </span>
            </div>
          );
        })}
        {/* Columna acciones vacía */}
        <div className="flex-1 min-w-24" />
      </div>

      {/* Filas */}
      {ordered.map((c) => (
        <ComponentRow
          key={c.id}
          componente={c}
          selected={highlightSelected && selectedId === c.id}
          onToggleSelect={onToggleSelect}
          fixedWidths={fixedWidths}
          showNombre={showNombre}
        />
      ))}
    </div>
  );
}
import type { AlertaHistorica } from '../types';
import { AlertaRow } from './AlertaRow';

/**
 * AlertsTable — tabla de alertas con header navy (`primary-extra-light`).
 *
 * Columnas (según Figma):
 *   Código | Fen. Climático | Fecha/hora predicción | Unidad Operativa
 *   | Umbral | Estado o fase | (acciones)
 *
 * Comportamiento:
 *   - Selección simple: solo UNA alerta seleccionada a la vez.
 *   - `sortSelectedFirst` (default true): la fila seleccionada se mueve
 *     al inicio de la tabla (igual que ComponentsTable).
 *   - `highlightSelected`: controla si la fila seleccionada se pinta
 *     de amarillo (útil en el panel del mapa; en el histórico se deja
 *     en false porque no hay sincronización con el mapa).
 *
 * Estilos:
 *   - Header: `bg-primary-extra-light` + texto BLANCO semibold `text-sm`.
 *   - Filas: texto `text-sm` (no text-base) para que quepan las acciones
 *     a la derecha sin recortarse en zoom 100%.
 */
interface AlertsTableProps {
  alertas: AlertaHistorica[];
  selectedId: string | null;
  onToggleSelect: (id: string) => void;
  /** Si true (default), el row seleccionado se mueve al inicio. */
  sortSelectedFirst?: boolean;
  /** Si true (default), el row usa fondo amarillo en selected. */
  highlightSelected?: boolean;
}

const HEADER_COLS = [
  { label: 'Código', minWidth: 'min-w-28' },
  { label: 'Fen. Climático', minWidth: 'min-w-36' },
  { label: 'Fecha/hora predicción', minWidth: 'min-w-48' },
  { label: 'Unidad Operativa', minWidth: 'min-w-48' },
  { label: 'Umbral', minWidth: 'min-w-28' },
  { label: 'Estado o fase', minWidth: 'min-w-36' },
];

export function AlertsTable({
  alertas,
  selectedId,
  onToggleSelect,
  sortSelectedFirst = true,
  highlightSelected = true,
}: AlertsTableProps) {
  // Ordenar: si hay seleccionado y sortSelectedFirst, ese va primero.
  const ordered = sortSelectedFirst && selectedId
    ? [
        ...alertas.filter((a) => a.id === selectedId),
        ...alertas.filter((a) => a.id !== selectedId),
      ]
    : alertas;

  return (
    <div className="self-stretch rounded-[10px] border border-input-stroke-main flex flex-col justify-start items-center gap-0.5 overflow-hidden">
      {/* Header — texto blanco, text-sm */}
      <div className="self-stretch h-12 bg-primary-extra-light rounded-tl-[10px] rounded-tr-[10px] inline-flex justify-between items-center">
        {HEADER_COLS.map((col) => (
          <div
            key={col.label}
            className={`flex-1 h-12 ${col.minWidth} px-3 py-2 bg-primary-extra-light flex justify-center items-center gap-2`}
          >
            <span className="text-text-invert-primary text-sm font-semibold font-sans">
              {col.label}
            </span>
          </div>
        ))}
        {/* Columna acciones vacía */}
        <div className="flex-1 min-w-24" />
      </div>

      {/* Filas */}
      {ordered.map((alerta) => (
        <AlertaRow
          key={alerta.id}
          alerta={alerta}
          selected={highlightSelected && selectedId === alerta.id}
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  );
}
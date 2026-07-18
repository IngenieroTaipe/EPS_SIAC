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
 *   - Selección simple: solo UNA alerta seleccionada a la vez. Props
 *     `selectedId` y `onToggleSelect`. Clic en otra → cambia la selección;
 *     clic en la misma → la deselecciona (toggle).
 *   - Lista de alertas: si se ordena/filtra fuera, este componente no lo
 *     hace. La lógica vive en el padre (MapAlertsPanel o HistoricoAlertasPage).
 *
 * Estilos:
 *   - Bordes externos `border-input-stroke-main`, radius `rounded-[10px]`.
 *   - Header: `bg-primary-extra-light` texto blanco semibold.
 *   - Filas: borde inferior `border-input-stroke-main`.
 *   - Fila seleccionada: `bg-background-selected` (amarillo `#fff7c7`).
 *
 * Variantes: el header puede recibir `selectionMode=false` para mostrar
 * el header "histórico" con columnas extra. Por ahora solo se usa una.
 */
interface AlertsTableProps {
  alertas: AlertaHistorica[];
  selectedId: string | null;
  onToggleSelect: (id: string) => void;
  /** Si true (default), el row usa fondo amarillo en selected. Si false, no
   *  aplica (útil en histórico donde la selección no resalta en el mapa). */
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
  highlightSelected = true,
}: AlertsTableProps) {
  return (
    <div className="self-stretch rounded-[10px] border border-input-stroke-main flex flex-col justify-start items-center gap-0.5 overflow-hidden">
      {/* Header */}
      <div className="self-stretch h-14 bg-primary-extra-light rounded-tl-[10px] rounded-tr-[10px] inline-flex justify-between items-center">
        {HEADER_COLS.map((col) => (
          <div
            key={col.label}
            className={`flex-1 h-14 ${col.minWidth} px-3.5 py-2.5 bg-primary-extra-light flex justify-center items-center gap-2.5`}
          >
            <span className="text-text-invert-primary text-base font-semibold font-sans">
              {col.label}
            </span>
          </div>
        ))}
        {/* Columna acciones (label vacío o nombre corto) */}
        <div className="flex-1 min-w-24" />
      </div>

      {/* Filas */}
      {alertas.map((alerta) => (
        <AlertaRow
          key={alerta.id}
          alerta={alerta}
          selected={
            highlightSelected && selectedId === alerta.id
          }
          onToggleSelect={onToggleSelect}
        />
      ))}
    </div>
  );
}
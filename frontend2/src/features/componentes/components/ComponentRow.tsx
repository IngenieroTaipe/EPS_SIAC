import { useNavigate } from 'react-router-dom';
import ViewIcon from '@/assets/icons/view.svg?react';
import EditIcon from '@/assets/icons/edit.svg?react';
import { cn } from '@/shared/lib/cn';
import {
  CRITICIDAD_LABEL,
  TIPO_LABEL,
  type Componente,
  type CriticidadComponente,
} from '@/features/mapa/types/componente';

/**
 * ComponentRow — fila de tabla de componentes (vista simple mapa + histórico).
 *
 * Columnas:
 *   1) Código
 *   2) Tipo
 *   3) Especificación
 *   4) Unidad Operativa
 *   5) Latitud
 *   6) Longitud
 *   7) Criticidad (badge color rojo / amarillo / verde según alta/media/baja)
 *   8) Acciones (view + edit icon button)
 *
 * Comportamiento:
 *   - Clic en row (no en iconos) → toggle selección.
 *   - Fila seleccionada: bg amarillo `bg-background-selected`.
 *   - View (ojito) → navega a `/componentes/gestion?id=<id>` (histórico).
 *     El `?id=` permite a la página del histórico resaltar el componente
 *     preseleccionado (pasado por "ver detalle").
 *   - Edit (lápiz) → navega a `/componentes/<id>/editar` (cuando se maquete
 *     el editor de componentes).
 *
 * Selección:
 *   - `selected` → fondo amarillo + borde cambio sutil.
 *   - Cuando se deselecciona, vuelve a fondo blanco.
 */

const CRITICIDAD_BADGE: Record<CriticidadComponente, string> = {
  'alta': 'bg-danger-states-hover text-danger-dark outline-danger-light',
  'media': 'bg-warning-states-hover text-warning-dark outline-warning-light',
  'baja': 'bg-success-states-hover text-success-dark outline-success-light',
};

interface ComponentRowProps {
  componente: Componente;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  /** Si true, fija el ancho de cada celda (útil en el histórico con
   *  más anchura disponible). Default = flex híbrido, similar al Figma. */
  fixedWidths?: boolean;
}

export function ComponentRow({
  componente,
  selected,
  onToggleSelect,
  fixedWidths = false,
}: ComponentRowProps) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => onToggleSelect(componente.id)}
      className={cn(
        'self-stretch inline-flex justify-between items-center overflow-hidden cursor-pointer transition-colors',
        'border-b border-input-stroke-main',
        selected
          ? 'bg-background-selected'
          : 'bg-white hover:bg-background-selected/40',
      )}
    >
      {/* Código */}
      <Cell minWidth="min-w-24" width="w-24">{componente.codigo}</Cell>
      {/* Tipo */}
      <Cell minWidth="min-w-36">{TIPO_LABEL[componente.tipo]}</Cell>
      {/* Especificación */}
      <Cell minWidth="min-w-48">{componente.especificacion}</Cell>
      {/* Unidad Operativa */}
      <Cell minWidth="min-w-40" width="w-40">{componente.unidadOperativa}</Cell>
      {/* Latitud */}
      <Cell minWidth="min-w-28">{componente.lat.toFixed(6)}</Cell>
      {/* Longitud */}
      <Cell minWidth="min-w-28">{componente.lng.toFixed(6)}</Cell>
      {/* Criticidad */}
      <div className={cn(
        'inline-flex justify-center items-center gap-2.5',
        fixedWidths ? 'w-24 px-2.5' : 'flex-1 min-w-24 px-2.5',
      )}>
        <div
          className={cn(
            'px-[5px] py-1 rounded-md outline outline-1 outline-offset-[-1px]',
            'text-sm font-normal font-sans',
            CRITICIDAD_BADGE[componente.criticidad],
          )}
        >
          {CRITICIDAD_LABEL[componente.criticidad]}
        </div>
      </div>

      {/* Acciones */}
      <div className={cn(
        'py-2 inline-flex justify-center items-center gap-2',
        fixedWidths ? 'w-24' : 'flex-1 min-w-24',
      )}>
        <IconButton
          label="Ver detalle"
          onClick={() =>
            navigate(`/componentes/gestion?id=${encodeURIComponent(componente.id)}`)
          }
        >
          <ViewIcon className="size-5 text-text-primary" aria-hidden="true" />
        </IconButton>
        <IconButton
          label="Editar"
          onClick={() =>
            navigate(`/componentes/${encodeURIComponent(componente.id)}/editar`)
          }
        >
          <EditIcon className="size-5 text-text-primary" aria-hidden="true" />
        </IconButton>
      </div>
    </div>
  );
}

function Cell({
  children,
  minWidth,
  width,
}: {
  children: React.ReactNode;
  minWidth: string;
  width?: string;
}) {
  return (
    <div
      className={cn(
        'h-10 px-3 py-2 flex justify-center items-center',
        width ?? 'flex-1',
        minWidth,
      )}
    >
      <span className="text-text-primary text-sm font-normal font-sans">
        {children}
      </span>
    </div>
  );
}

/** Botón de icono reutilizable. */
function IconButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="h-7 px-1 py-1 bg-background-main rounded-lg outline outline-[0.5px] outline-input-stroke-main
                 inline-flex items-center justify-center transition-colors
                 hover:bg-primary-states-hover-main
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main focus-visible:ring-offset-2"
    >
      {children}
    </button>
  );
}
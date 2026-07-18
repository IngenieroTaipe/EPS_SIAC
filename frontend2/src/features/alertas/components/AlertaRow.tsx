import { useNavigate } from 'react-router-dom';
import ViewIcon from '@/assets/icons/view.svg?react';
import EditIcon from '@/assets/icons/edit.svg?react';
import { cn } from '@/shared/lib/cn';
import { ESTADO_LABEL, type AlertaHistorica } from '../types';
import { formatFechaHora } from '../stepper-utils';

/**
 * AlertaRow — fila de la tabla de alertas (variante simple, NO el histórico completo).
 *
 * Columnas (según Figma):
 *   1) Código           (PK-XXXX)
 *   2) Fen. Climático
 *   3) Fecha/hora predicción
 *   4) Unidad Operativa
 *   5) Umbral            (etiqueta legible)
 *   6) Estado o fase     (badge con color del estado)
 *   7) Acciones          (iconos view + edit)
 *
 * Comportamiento:
 *   - Clic en la fila (no en los iconos) → alterna selección (función `onToggleSelect`).
 *   - Fondo amarillo `bg-background-selected` cuando está seleccionada.
 *   - Botón view → navega a `/alertas/gestion` (tabla histórico completo).
 *   - Botón edit → navega a `/alertas/${id}/editar` (editor de estados).
 *   - Botón edit deshabilitado (estilo apagado) cuando estado = 'atendido' o 'no-confirmado'.
 */

const UMBRAL_LABEL = {
  'moderadamente-lluvioso': 'Moderadamente Lluvioso',
  'lluvioso': 'Lluvioso',
  'muy-lluvioso': 'Muy Lluvioso',
  'extremadamente-lluvioso': 'Extremadamente Lluvioso',
} as const;

const STATUS_BADGE: Record<string, string> = {
  'predicho': 'bg-alerts-status-predicho text-text-primary',
  'en-espera-confirmacion': 'bg-alerts-status-en-espera-confirmacion text-text-primary',
  'no-confirmado': 'bg-alerts-status-no-confirmado text-text-invert-primary',
  'confirmado': 'bg-alerts-status-confirmado-reporte text-text-invert-primary',
  'en-espera-reporte': 'bg-alerts-status-confirmado-reporte text-text-invert-primary',
  'en-proceso-atencion': 'bg-alerts-status-en-proceso-atencion text-text-invert-primary',
  'atendido': 'bg-alerts-status-atendido text-text-primary',
};

interface AlertaRowProps {
  alerta: AlertaHistorica;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}

export function AlertaRow({ alerta, selected, onToggleSelect }: AlertaRowProps) {
  const navigate = useNavigate();
  const isReadOnly = alerta.estado === 'atendido' || alerta.estado === 'no-confirmado';
  const isAtendido = alerta.estado === 'atendido';

  return (
    <div
      onClick={() => onToggleSelect(alerta.id)}
      className={cn(
        'self-stretch inline-flex justify-between items-center overflow-hidden cursor-pointer transition-colors',
        'border-b border-input-stroke-main',
        selected ? 'bg-background-selected' : 'bg-white hover:bg-background-selected/40',
      )}
    >
      {/* Código */}
      <Cell minWidth="min-w-28">{alerta.id}</Cell>
      {/* Fenómeno */}
      <Cell minWidth="min-w-36">{alerta.fenomeno}</Cell>
      {/* Fecha predicción */}
      <Cell minWidth="min-w-48">{formatFechaHora(alerta.fechaPrediccionInicio)}</Cell>
      {/* Unidad operativa */}
      <Cell minWidth="min-w-48">{alerta.unidadOperativa}</Cell>
      {/* Umbral */}
      <Cell minWidth="min-w-28">{UMBRAL_LABEL[alerta.umbral]}</Cell>
      {/* Estado badge */}
      <div className="flex-1 min-w-36 px-2.5 inline-flex justify-center items-center">
        <div
          className={cn(
            'px-4 py-[5px] rounded-lg text-sm font-normal font-sans',
            STATUS_BADGE[alerta.estado],
          )}
        >
          {ESTADO_LABEL[alerta.estado]}
        </div>
      </div>
      {/* Acciones */}
      <div className="flex-1 min-w-24 py-2.5 rounded-lg inline-flex justify-center items-center gap-2.5">
        <IconButton
          label="Ver detalle"
          onClick={() => navigate('/alertas/gestion')}
        >
          <ViewIcon className="size-6 text-text-primary" aria-hidden="true" />
        </IconButton>
        <IconButton
          label="Editar"
          disabled={isReadOnly || isAtendido}
          subtle={isReadOnly || isAtendido}
          onClick={() => navigate(`/alertas/${alerta.id}/editar`)}
        >
          <EditIcon
            className={cn(
              'size-6',
              isReadOnly || isAtendido
                ? 'text-text-status-placeholder'
                : 'text-text-primary',
            )}
            aria-hidden="true"
          />
        </IconButton>
      </div>
    </div>
  );
}

/** Celda estándar. */
function Cell({
  children,
  minWidth,
}: {
  children: React.ReactNode;
  minWidth: string;
}) {
  return (
    <div className={cn('flex-1 h-12 px-3.5 py-2.5 flex justify-center items-center', minWidth)}>
      <span className="text-text-primary text-base font-normal font-sans">{children}</span>
    </div>
  );
}

/** Botón de icono redondeado (bg blanco, outline input-stroke). */
function IconButton({
  children,
  label,
  onClick,
  disabled = false,
  subtle = false,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  subtle?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        // Evitar que el clic en el botón se propague al row (que selecciona).
        e.stopPropagation();
        if (!disabled) onClick();
      }}
      className={cn(
        'h-8 px-[5px] py-2.5 bg-background-main rounded-lg outline outline-[0.5px] outline-input-stroke-main',
        'inline-flex items-center justify-center transition-colors',
        'hover:bg-primary-states-hover-main',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main focus-visible:ring-offset-2',
        subtle && 'opacity-50 cursor-not-allowed hover:bg-background-main',
      )}
    >
      {children}
    </button>
  );
}
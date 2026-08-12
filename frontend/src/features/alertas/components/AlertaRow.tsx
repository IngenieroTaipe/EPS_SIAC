import { useNavigate } from 'react-router-dom';
import { Pencil, Eye } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { ESTADO_LABEL, type AlertaHistorica } from '../types';
import { ESTADO_VISUAL, UMBRAL_LABEL } from '../alerta-utils';
import { formatFechaHora } from '../stepper-utils';

/**
 * AlertaRow — fila de la tabla de alertas.
 *
 * Diseño minimalista alineado con `ComponentRow`:
 *   - Filas en blanco con separadores hairline (`border-input-stroke-main`).
 *   - Hover sutil `bg-primary-states-hover-main/10`.
 *   - Fila seleccionada: fondo `background-selected` (amarillo muy suave)
 *     cuando `highlightSelected=true` en la tabla.
 *
 * Columnas (en este orden):
 *   1) Código                  — texto semibold navy (identidad)
 *   2) Fen. Climático          — fenómeno detectado
 *   3) Fecha/hora predicción   — fecha legible
 *   4) Unidad Operativa
 *   5) Umbral                  — etiqueta legible
 *   6) Estado o fase           — badge de color del estado
 *   7) Acciones                — botón Editar (gestion) o view+edit (mapa)
 *
 * Variantes:
 *   - `gestion` (default): clic en la fila abre el `AlertaDetailSheet`
 *     (`onOpenDetail` obligatorio); sólo botón Editar standalone. Es la
 *     variante usada por `HistoricoAlertasPage`.
 *   - `mapa`: clic en la fila alterna selección (`onToggleSelect`) y
 *    _resalta en el mapa_; mantiene los botones view (→ histórico) + edit.
 *     Usada por `MapAlertsPanel`.
 */

export type AlertaRowVariant = 'mapa' | 'gestion';

interface AlertaRowProps {
  alerta: AlertaHistorica;
  selected: boolean;
  /** Toggle selección (variante `mapa`). */
  onToggleSelect?: (id: string) => void;
  /** Abrir el sheet de detalle al clic en fila (variante `gestion`). */
  onOpenDetail?: (alerta: AlertaHistorica) => void;
  /** Si true, fija el ancho de cada celda (gestión con scroll horizontal). */
  fixedWidths?: boolean;
  /** Variante. Default `gestion`. */
  variant?: AlertaRowVariant;
}

export function AlertaRow({
  alerta,
  selected,
  onToggleSelect,
  onOpenDetail,
  fixedWidths = false,
  variant = 'gestion',
}: AlertaRowProps) {
  const navigate = useNavigate();
  const a = alerta;
  const esGestion = variant === 'gestion';
  const visual = ESTADO_VISUAL[a.estado];
  const isReadOnly = a.estado === 'atendido' || a.estado === 'no-confirmado';

  function handleRowClick() {
    if (esGestion) onOpenDetail?.(a);
    else onToggleSelect?.(a.id);
  }

  function handleEditClick(e: React.MouseEvent) {
    e.stopPropagation();
    // El backend cambió `lookup_field` a `id` (PK numérico); navegamos
    // con backendId cuando está, si no cae a `id` (mock/legacy).
    const editId = a.backendId ?? a.id;
    navigate(`/alertas/${encodeURIComponent(editId)}/editar`);
  }

  function handleViewClick(e: React.MouseEvent) {
    e.stopPropagation();
    navigate(`/alertas/gestion?id=${encodeURIComponent(a.id)}`);
  }

  return (
    <div
      onClick={handleRowClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleRowClick();
        }
      }}
      className={cn(
        'self-stretch inline-flex items-stretch overflow-hidden cursor-pointer transition-colors',
        'border-b border-input-stroke-main',
        selected
          ? 'bg-background-selected'
          : 'bg-background-main hover:bg-primary-states-hover-main/10',
      )}
    >
      {/* 1. Código */}
      <Cell minWidth="min-w-24" width="w-32" bold>
        {a.id}
      </Cell>
      {/* 2. Fenómeno */}
      <Cell minWidth="min-w-36" width="w-44">
        <span className="truncate" title={a.fenomeno}>{a.fenomeno}</span>
      </Cell>
      {/* 3. Fecha predicción */}
      <Cell minWidth="min-w-48" width="w-56" mono>
        {formatFechaHora(a.fechaPrediccionInicio)}
      </Cell>
      {/* 4. Unidad operativa */}
      <Cell minWidth="min-w-40" width="w-56">
        <span className="truncate" title={a.unidadOperativa}>
          {a.unidadOperativa || '—'}
        </span>
      </Cell>
      {/* 5. Umbral */}
      <Cell minWidth="min-w-36" width="w-48">
        <span className="truncate text-text-secondary" title={UMBRAL_LABEL[a.umbral]}>
          {UMBRAL_LABEL[a.umbral]}
        </span>
      </Cell>
      {/* 6. Estado badge */}
      <div className={cn(
        'inline-flex justify-center items-center px-3 py-2',
        fixedWidths ? 'w-44' : 'flex-1 min-w-36',
      )}>
        <div
          className={cn(
            'px-2 py-0.5 rounded-md text-xs font-bold font-sans inline-flex items-center gap-1.5',
            visual.badge,
          )}
        >
          <span className={cn('size-2 rounded-full', visual.dot)} />
          {ESTADO_LABEL[a.estado]}
        </div>
      </div>

      {/* 7. Acciones */}
      <div className={cn(
        'inline-flex justify-center items-center gap-2 px-3',
        fixedWidths ? 'w-20' : 'flex-1 min-w-20',
      )}>
        {esGestion ? (
          isReadOnly ? (
            // En estados terminales (atendido / no-confirmado), el lápiz
            // está deshabilitado porque ya no se puede editar. En su
            // lugar mostramos un botón "Ver" (ojo) que navega a la misma
            // ruta de edición para que el operador pueda revisar el
            // reporte de daños/acciones y el histórico sellado en modo
            // solo lectura.
            <button
              type="button"
              aria-label="Ver detalle de la alerta"
              onClick={handleEditClick}
              className={cn(
                'size-8 inline-flex items-center justify-center rounded-lg',
                'outline outline-1 outline-offset-[-1px] outline-input-stroke-main',
                'text-text-primary bg-background-main transition-colors',
                'hover:bg-primary-main hover:text-text-invert-primary',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main focus-visible:ring-offset-2',
              )}
            >
              <Eye className="size-4" strokeWidth={2} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              aria-label="Editar alerta"
              onClick={handleEditClick}
              className={cn(
                'size-8 inline-flex items-center justify-center rounded-lg',
                'outline outline-1 outline-offset-[-1px] outline-input-stroke-main',
                'text-text-primary bg-background-main transition-colors',
                'hover:bg-primary-main hover:text-text-invert-primary',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main focus-visible:ring-offset-2',
              )}
            >
              <Pencil className="size-4" strokeWidth={2} aria-hidden="true" />
            </button>
          )
        ) : (
          <>
            <IconButton
              label="Ver en histórico"
              onClick={handleViewClick}
            >
              <Eye className="size-5 text-text-primary" aria-hidden="true" />
            </IconButton>
            <IconButton
              label="Editar"
              disabled={isReadOnly}
              onClick={handleEditClick}
            >
              <Pencil
                className={cn(
                  'size-5',
                  isReadOnly ? 'text-text-status-placeholder' : 'text-text-primary',
                )}
                aria-hidden="true"
              />
            </IconButton>
          </>
        )}
      </div>
    </div>
  );
}

/** Celda de texto. `bold` para identidad (código). `mono` para fechas. */
function Cell({
  children,
  minWidth,
  width,
  bold = false,
  mono = false,
}: {
  children: React.ReactNode;
  minWidth: string;
  width?: string;
  bold?: boolean;
  mono?: boolean;
}) {
  return (
    <div
      className={cn(
        'h-11 px-3 py-2 inline-flex items-center',
        width ?? 'flex-1',
        minWidth,
      )}
    >
      <span
        className={cn(
          'text-sm font-sans truncate',
          bold
            ? 'text-primary-main font-bold'
            : 'text-text-primary font-normal',
          mono && 'font-mono tabular-nums',
        )}
      >
        {children}
      </span>
    </div>
  );
}

/** Botón de icono redondeado (variante mapa). */
function IconButton({
  children,
  label,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onClick(e);
      }}
      className={cn(
        'size-8 bg-background-main rounded-lg outline outline-1 outline-offset-[-1px] outline-input-stroke-main',
        'inline-flex items-center justify-center transition-colors',
        'hover:bg-primary-states-hover-main',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main focus-visible:ring-offset-2',
        disabled && 'opacity-40 cursor-not-allowed hover:bg-background-main',
      )}
    >
      {children}
    </button>
  );
}
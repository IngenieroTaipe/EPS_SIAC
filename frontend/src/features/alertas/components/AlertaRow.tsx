import { useNavigate } from 'react-router-dom';
import { Pencil, Eye } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { ESTADO_LABEL, type AlertaHistorica } from '../types';
import { ESTADO_VISUAL, UMBRAL_LABEL } from '../alerta-utils';
import { formatFechaHora } from '../stepper-utils';

/**
 * AlertaRow — fila (`<tr>`) de la tabla de alertas (gestión).
 *
 * Es una fila de tabla HTML real dentro del `<table>` de `AlertsTable`
 * (mismo patrón que `ComponentRow`): los anchos de columna NO se definen
 * aquí (los define el `<colgroup>` de la tabla), por lo que el encabezado
 * y todas las filas cuadran siempre.
 *
 * Diseño minimalista:
 *   - Filas en blanco con separadores hairline (`border-input-stroke-main`).
 *   - Hover sutil `bg-primary-states-hover-main/10`.
 *   - Fila seleccionada: fondo `background-selected` (amarillo muy suave)
 *     cuando `highlightSelected=true` en la tabla.
 *
 * Columnas (en este orden, alineadas con el colgroup de AlertsTable):
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
 *     resalta en el mapa; mantiene los botones view + edit (legacy).
 */

export type AlertaRowVariant = 'mapa' | 'gestion';

interface AlertaRowProps {
  alerta: AlertaHistorica;
  selected: boolean;
  /** Toggle selección (variante `mapa`). */
  onToggleSelect?: (id: string) => void;
  /** Abrir el sheet de detalle al clic en fila (variante `gestion`). */
  onOpenDetail?: (alerta: AlertaHistorica) => void;
  /** Variante. Default `gestion`. */
  variant?: AlertaRowVariant;
}

export function AlertaRow({
  alerta,
  selected,
  onToggleSelect,
  onOpenDetail,
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
    <tr
      onClick={handleRowClick}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleRowClick();
        }
      }}
      className={cn(
        'cursor-pointer transition-colors',
        'border-b border-input-stroke-main',
        selected
          ? 'bg-background-selected'
          : 'bg-background-main hover:bg-primary-states-hover-main/10',
      )}
    >
      {/* 1. Código */}
      <Td bold>{a.id}</Td>
      {/* 2. Fenómeno */}
      <Td>
        <span className="truncate" title={a.fenomeno}>{a.fenomeno}</span>
      </Td>
      {/* 3. Fecha predicción */}
      <Td mono>{formatFechaHora(a.fechaPrediccionInicio)}</Td>
      {/* 4. Unidad operativa */}
      <Td>
        <span className="truncate" title={a.unidadOperativa}>
          {a.unidadOperativa || '—'}
        </span>
      </Td>
      {/* 5. Umbral */}
      <Td secondary>
        <span className="truncate" title={UMBRAL_LABEL[a.umbral]}>
          {UMBRAL_LABEL[a.umbral]}
        </span>
      </Td>
      {/* 6. Estado badge */}
      <td className="h-11 px-3 py-2 text-center align-middle">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold font-sans',
            visual.badge,
          )}
        >
          <span className={cn('size-2 rounded-full', visual.dot)} />
          {ESTADO_LABEL[a.estado]}
        </span>
      </td>

      {/* 7. Acciones */}
      <td className="h-11 px-3 py-2 text-center align-middle">
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
      </td>
    </tr>
  );
}

/**
 * Celda de texto (`<td>`) — sin ancho propio (lo define el `<colgroup>` de
 * la tabla). `bold` para identidad (código). `mono` para fechas. El
 * contenido trunca con title tooltip.
 */
function Td({
  children,
  bold = false,
  mono = false,
  secondary = false,
}: {
  children: React.ReactNode;
  bold?: boolean;
  mono?: boolean;
  secondary?: boolean;
}) {
  return (
    <td className="h-11 px-3 py-2 align-middle">
      <span
        className={cn(
          'block text-sm font-sans truncate',
          bold
            ? 'text-primary-main font-bold'
            : secondary
              ? 'text-text-secondary font-normal'
              : 'text-text-primary font-normal',
          mono && 'font-mono tabular-nums',
        )}
      >
        {children}
      </span>
    </td>
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

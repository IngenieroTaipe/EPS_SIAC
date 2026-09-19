import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import {
  CRITICIDAD_LABEL,
  TIPO_LABEL,
  type Componente,
  type CriticidadComponente,
} from '@/features/mapa/types/componente';

/**
 * ComponentRow — fila (`<tr>`) de la tabla de componentes (gestión).
 *
 * Es una fila de tabla HTML real dentro del `<table>` de `ComponentsTable`:
 * los anchos de columna NO se definen aquí (los define el `<colgroup>` de
 * la tabla), por lo que el encabezado y todas las filas cuadran siempre.
 *
 * Diseño minimalista:
 *   - Filas en blanco con separadores hairline (`border-input-stroke-main`).
 *   - Hover sutil `bg-primary-states-hover-main/10` (sin outline grueso).
 *   - Fila seleccionada: fondo `background-selected` (amarillo muy suave).
 *   - Clic en cualquier zona no-acción abre el sheet de detalle.
 *
 * Columnas (en este orden, alineadas con el colgroup de ComponentsTable):
 *   1) Código        — texto semibold navy (identidad del componente)
 *   2) Unidad Operativa
 *   3) Nombre
 *   4) Tipo          — etiqueta legible de TIPO_LABEL
 *   5) Especificación— texto secundario
 *   6) Este UTM      — tabular-nums (mono)
 *   7) Norte UTM     — tabular-nums (mono)
 *   8) Estado Op.    — texto plano, sin badge de color
 *   9) Estado Fís.   — texto plano, sin badge de color
 *  10) Criticidad    — badge de color (o '—' si el backend no la envía)
 *  11) Acciones      — botón "Editar" standalone
 *
 * Variantes:
 *   - `gestion` → fila clickeable que abre el sheet (onOpenDetail).
 *   - `mapa`    → variante legacy (toggle selección).
 */

const CRITICIDAD_BADGE: Record<CriticidadComponente, string> = {
  'alta': 'bg-danger-states-hover text-danger-dark outline-danger-light',
  'media': 'bg-warning-states-hover text-warning-dark outline-warning-light',
  'baja': 'bg-success-states-hover text-success-dark outline-success-light',
};

export type ComponentRowVariant = 'mapa' | 'gestion';

interface ComponentRowProps {
  componente: Componente;
  /** Fila resaltada (seleccionada en el sheet). */
  selected: boolean;
  /** Toggle de selección para variante `mapa`. */
  onToggleSelect?: (id: string) => void;
  /** Abrir el sheet de detalle al clic en la fila (variante `gestion`). */
  onOpenDetail?: (componente: Componente) => void;
  /** Eliminar componente (tachito). La página confirma antes vía
   *  ConfirmDialog; el row sólo dispara el intento. */
  onDelete?: (componente: Componente) => void;
  /** Variante. Default `gestion`. */
  variant?: ComponentRowVariant;
}

export function ComponentRow({
  componente,
  selected,
  onToggleSelect,
  onOpenDetail,
  onDelete,
  variant = 'gestion',
}: ComponentRowProps) {
  const navigate = useNavigate();
  const c = componente;
  const esGestion = variant === 'gestion';

  function handleRowClick() {
    if (esGestion) {
      onOpenDetail?.(c);
    } else {
      onToggleSelect?.(c.id);
    }
  }

  function handleEditClick(e: React.MouseEvent) {
    e.stopPropagation();
    navigate(`/componentes/${encodeURIComponent(c.id)}/editar`);
  }

  function handleDeleteClick(e: React.MouseEvent) {
    e.stopPropagation();
    onDelete?.(c);
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
      <Td bold>{c.codigo}</Td>
      {/* 2. Unidad Operativa */}
      <Td>
        <span className="truncate" title={c.unidadOperativa}>{c.unidadOperativa || '—'}</span>
      </Td>
      {/* 3. Nombre */}
      <Td>
        <span className="truncate" title={c.nombre}>{c.nombre || '—'}</span>
      </Td>
      {/* 4. Tipo */}
      <Td>
        <span className="truncate" title={TIPO_LABEL[c.tipo]}>{TIPO_LABEL[c.tipo]}</span>
      </Td>
      {/* 5. Este UTM */}
      <Td mono>{c.utmEasting != null ? formatUtm(c.utmEasting) : '—'}</Td>
      {/* 6. Norte UTM */}
      <Td mono>{c.utmNorthing != null ? formatUtm(c.utmNorthing) : '—'}</Td>
      {/* 7. Estado Operacional (texto plano, sin badge) */}
      <Td>
        <span className="truncate" title={c.estadoOperacional ?? ''}>
          {c.estadoOperacional ?? '—'}
        </span>
      </Td>
      {/* 8. Estado Físico (texto plano, sin badge) */}
      <Td>
        <span className="truncate" title={c.estadoFisico ?? ''}>
          {c.estadoFisico ?? '—'}
        </span>
      </Td>
      {/* 9. Criticidad (badge de color, o '—' si el backend no la envía) */}
      <td className="h-11 px-3 py-2 text-center align-middle">
        {c.criticidad ? (
          <span
            className={cn(
              'inline-block px-2 py-0.5 rounded-md text-xs font-bold font-sans',
              CRITICIDAD_BADGE[c.criticidad],
            )}
          >
            {CRITICIDAD_LABEL[c.criticidad]}
          </span>
        ) : (
          <span className="text-text-secondary text-xs font-sans">—</span>
        )}
      </td>

      {/* 10. Acciones — Editar + Eliminar (con confirmación en la página) */}
      <td className="h-11 px-3 py-2 text-center align-middle">
        <div className="inline-flex items-center gap-2">
          <button
            type="button"
            aria-label="Editar componente"
            onClick={handleEditClick}
            className="size-8 inline-flex items-center justify-center rounded-lg
                       outline outline-1 outline-offset-[-1px] outline-input-stroke-main
                       text-text-primary bg-background-main
                       hover:bg-primary-main hover:text-text-invert-primary transition-colors
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main focus-visible:ring-offset-2"
          >
            <Pencil className="size-4" strokeWidth={2} aria-hidden="true" />
          </button>
          {onDelete && (
            <button
              type="button"
              aria-label="Eliminar componente"
              onClick={handleDeleteClick}
              className="size-8 inline-flex items-center justify-center rounded-lg
                         outline outline-1 outline-offset-[-1px] outline-input-stroke-main
                         text-text-primary bg-background-main
                         hover:bg-secondary-main hover:text-text-invert-primary transition-colors
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary-main focus-visible:ring-offset-2"
            >
              <Trash2 className="size-4" strokeWidth={2} aria-hidden="true" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

/**
 * Celda de texto (`<td>`) — sin ancho propio (lo define el `<colgroup>` de
 * la tabla). `bold` para identidad (código). `mono` para UTM. `secondary`
 * para texto atenuado. El contenido trunca con title tooltip.
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

/** Formatea UTM con separador de miles (sin decimales, los datos son 0.00). */
function formatUtm(v: number): string {
  const rounded = Math.round(v);
  return rounded.toLocaleString('es-PE');
}

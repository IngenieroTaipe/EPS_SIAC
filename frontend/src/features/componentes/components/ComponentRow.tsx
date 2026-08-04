import { useNavigate } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import {
  CRITICIDAD_LABEL,
  TIPO_LABEL,
  type Componente,
  type CriticidadComponente,
} from '@/features/mapa/types/componente';

/**
 * ComponentRow — fila de la tabla de componentes (gestión).
 *
 * Diseño minimalista:
 *   - Filas en blanco con separadores hairline (`border-input-stroke-main`).
 *   - Hover sutil `bg-primary-states-hover-main/10` (sin outline grueso).
 *   - Fila seleccionada: fondo `background-selected` (amarillo muy suave).
 *   - Clic en cualquier zona no-acción abre el sheet de detalle.
 *
 * Columnas (en este orden):
 *   1) Código        — texto semibold navy (identidad del componente)
 *   2) Unidad Operativa
 *   3) Nombre
 *   4) Tipo          — etiqueta legible de TIPO_LABEL
 *   5) Especificación— texto secundario
 *   6) Este UTM      — tabular-nums (mono)
 *   7) Norte UTM     — tabular-nums (mono)
 *   8) Estado        — texto plano, sin badge de color
 *   9) Criticidad    — badge de color (alto/media/baja)
 *  10) Acciones      — botón "Editar" standalone
 *
 * La columna "Ver detalle" ya no existe como botón: el clic en la fila
 * COMPLETA abre el sheet (mismo comportamiento que el clic en el marcador
 * del mapa). El botón "Editar" Pestillo independiente sigue para no
 * obligar al usuario a pasar por el sheet.
 *
 * Variantes:
 *   - `gestion` → fila clickeable que abre el sheet (onOpenDetail
 *                 obligatorio) + solo botón Editar. Es la variante por
 *                 defecto y la única usada actualmente.
 *   - `mapa`    → variante legacy (mantenida por compat con `ComponentsTable`
 *                 del panel del mapa, ya retirado del flujo principal). Sin
 *                 acción de apertura de sheet; el toggle selecciona.
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
  /** Si true, fija el ancho de cada celda (gestión con scroll horizontal). */
  fixedWidths?: boolean;
  /** Variante. Default `gestion`. */
  variant?: ComponentRowVariant;
}

export function ComponentRow({
  componente,
  selected,
  onToggleSelect,
  onOpenDetail,
  fixedWidths = false,
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
      <Cell minWidth="min-w-24" width="w-28" bold>
        {c.codigo}
      </Cell>
      {/* 2. Unidad Operativa */}
      <Cell minWidth="min-w-32" width="w-40">{c.unidadOperativa}</Cell>
      {/* 3. Nombre */}
      <Cell minWidth="min-w-40" width="w-56">
        <span className="truncate" title={c.nombre}>{c.nombre || '—'}</span>
      </Cell>
      {/* 4. Tipo */}
      <Cell minWidth="min-w-36" width="w-48">
        <span className="truncate" title={TIPO_LABEL[c.tipo]}>{TIPO_LABEL[c.tipo]}</span>
      </Cell>
      {/* 5. Especificación */}
      <Cell minWidth="min-w-40" width="w-56">
        <span className="truncate text-text-secondary" title={c.especificacion}>
          {c.especificacion || '—'}
        </span>
      </Cell>
      {/* 6. Este UTM */}
      <Cell minWidth="min-w-28" width="w-32" mono>
        {c.utmEasting != null ? formatUtm(c.utmEasting) : '—'}
      </Cell>
      {/* 7. Norte UTM */}
      <Cell minWidth="min-w-28" width="w-32" mono>
        {c.utmNorthing != null ? formatUtm(c.utmNorthing) : '—'}
      </Cell>
      {/* 8. Estado (texto plano, sin badge) */}
      <Cell minWidth="min-w-24" width="w-28">{capitalize(c.estado)}</Cell>
      {/* 9. Criticidad (badge de color) */}
      <div className={cn(
        'inline-flex justify-center items-center gap-2.5 px-3 py-2',
        fixedWidths ? 'w-28' : 'flex-1 min-w-28',
      )}>
        <div
          className={cn(
            'px-2 py-0.5 rounded-md text-xs font-bold font-sans',
            CRITICIDAD_BADGE[c.criticidad],
          )}
        >
          {CRITICIDAD_LABEL[c.criticidad]}
        </div>
      </div>

      {/* 10. Acciones — botón Editar standalone */}
      <div className={cn(
        'inline-flex justify-center items-center px-3',
        fixedWidths ? 'w-20' : 'flex-1 min-w-20',
      )}>
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
      </div>
    </div>
  );
}

/** Celda de texto. `bold` para identidad (código). `mono` para UTM. */
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

/** Formatea UTM con separador de miles (sin decimales, los datos son 0.00). */
function formatUtm(v: number): string {
  const rounded = Math.round(v);
  return rounded.toLocaleString('es-PE');
}

function capitalize(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
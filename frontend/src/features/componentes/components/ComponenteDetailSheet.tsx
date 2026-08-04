import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Pencil } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import {
  CRITICIDAD_LABEL,
  TIPO_LABEL,
  type Componente,
  type CriticidadComponente,
} from '@/features/mapa/types/componente';

/**
 * ComponenteDetailSheet — panel lateral derecho con el detalle completo de
 * un componente. Se monta **dentro del contenedor del mapa** (absolute
 * inset-y-0 right-0) para ocupar exactamente la altura del mapa y no tapar
 * el TopBar ni la timeline inferior. Como no hay overlay full-screen, el
 * usuario sigue pudiendo arrastrar/zoom el mapa y hacer clic en otros
 * marcadores (el padre resuelve el `selectedComponente` y el sheet se
 * actualiza en vivo).
 *
 * También se usa desde `HistoricoComponentesPage` (Gestión de Componentes)
 * al hacer clic en una fila de la tabla: ahí renderiza fijo dentro del
 * layout de la página (no `absolute`) mediante la prop `floating=false`.
 *
 * Acciones:
 *   - "Editar" → navega a `/componentes/:id/editar` (EditorComponentePage).
 *   - "Cerrar" → botón X dentro del header + tecla Escape. El padre cierra
 *     poniendo `componente=null` (lo que desmonta el sheet).
 *
 * Renderiza todos los campos relevantes del `Componente`: tipo, código,
 * nombre, especificación, unidad operativa, criticidad (badge de color),
 * estado (texto plano), lat/lng, UTM Este/Norte + zona, fecha de
 * actualización y —para líneas— la lista de N vértices con su UTM.
 */

const CRITICIDAD_BADGE: Record<CriticidadComponente, string> = {
  'alta': 'bg-danger-states-hover text-danger-dark outline-danger-light',
  'media': 'bg-warning-states-hover text-warning-dark outline-warning-light',
  'baja': 'bg-success-states-hover text-success-dark outline-success-light',
};

interface ComponenteDetailSheetProps {
  /** Componente a mostrar. `null` indica sheet cerrado. */
  componente: Componente | null;
  onClose: () => void;
  /**
   * `true` (default) → sheet flotante `absolute inset-y-0 right-0` (uso
   * típico dentro del contenedor del mapa). `false` → layout estático
   * dentro del flujo de la página (uso en gestión, no flotante).
   */
  floating?: boolean;
}

export function ComponenteDetailSheet({
  componente,
  onClose,
  floating = true,
}: ComponenteDetailSheetProps) {
  const navigate = useNavigate();

  // Cierra con Escape.
  useEffect(() => {
    if (!componente) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [componente, onClose]);

  if (!componente) return null;

  const c = componente;
  const esLinea = c.puntos && c.puntos.length >= 2;

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-label={`Detalle del componente ${c.codigo}`}
      className={cn(
        floating
          ? 'absolute inset-y-0 right-0 z-[1000] w-full max-w-md'
          : 'h-full w-full max-w-md',
        'bg-background-main shadow-[-4px_0_8px_0px_rgba(0,0,0,0.20)] border-l border-input-stroke-main',
        'flex flex-col pointer-events-auto',
      )}
    >
      {/* Header con título + botón cerrar */}
      <div className="flex items-start justify-between gap-4 p-5 border-b border-input-stroke-main">
        <div className="flex flex-col gap-1">
          <span className="text-text-secondary text-xs font-sans uppercase tracking-wide">
            {TIPO_LABEL[c.tipo]}
          </span>
          <h2 className="text-text-primary text-lg font-bold font-sans leading-tight">
            {c.nombre || c.codigo}
          </h2>
          <span className="text-text-secondary text-sm font-sans">
            Código <strong className="text-text-primary">{c.codigo}</strong>
          </span>
        </div>
        <button
          type="button"
          aria-label="Cerrar panel de detalle"
          onClick={onClose}
          className="size-8 inline-flex items-center justify-center rounded-lg
                     outline outline-1 outline-offset-[-1px] outline-input-stroke-main
                     text-text-primary hover:bg-primary-states-hover-main/30
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main focus-visible:ring-offset-2
                     transition-colors"
        >
          <X className="size-5" strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      {/* Cuerpo scrolleable */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
        {/* Badges de criticidad + estados (sólo criticidad lleva color) */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'px-2 py-1 rounded-md outline outline-1 outline-offset-[-1px] text-xs font-sans font-bold',
              CRITICIDAD_BADGE[c.criticidad],
            )}
          >
            Criticidad {CRITICIDAD_LABEL[c.criticidad]}
          </span>
          <span className="px-2 py-1 rounded-md outline outline-1 outline-offset-[-1px] outline-input-stroke-main text-xs font-sans font-bold text-text-primary">
            Estado Op.: {c.estadoOperacional ?? '—'}
          </span>
          <span className="px-2 py-1 rounded-md outline outline-1 outline-offset-[-1px] outline-input-stroke-main text-xs font-sans font-bold text-text-primary">
            Estado Fís.: {c.estadoFisico ?? '—'}
          </span>
        </div>

        {/* Ficha técnica */}
        <dl className="grid grid-cols-1 gap-x-4 gap-y-3">
          {c.especificacion && (
            <Field label="Especificación" value={c.especificacion} />
          )}
          <Field label="Unidad Operativa" value={c.unidadOperativa} />

          {/* Lat/Lng */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Latitud" value={c.lat.toFixed(6)} mono />
            <Field label="Longitud" value={c.lng.toFixed(6)} mono />
          </div>

          {/* UTM (punto o primer vértice) */}
          {c.utmEasting != null && c.utmNorthing != null ? (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Este UTM" value={formatUtm(c.utmEasting)} mono />
              <Field label="Norte UTM" value={formatUtm(c.utmNorthing)} mono />
            </div>
          ) : null}
          {c.utmZone && (
            <Field label="Zona UTM" value={c.utmZone} mono />
          )}

          {/* Vértices (sólo líneas con N puntos) */}
          {esLinea && c.verticesUtm && c.verticesUtm.length > 0 && (
            <div className="flex flex-col gap-2">
              <dt className="text-text-secondary text-xs font-sans uppercase tracking-wide">
                Vértices del trazado ({c.verticesUtm.length})
              </dt>
              <dd>
                <ol className="flex flex-col gap-1 max-h-56 overflow-y-auto
                               border border-input-stroke-main rounded-lg overflow-hidden">
                  {c.verticesUtm.map((v, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-3 px-3 py-1.5
                                 bg-background-main border-b border-input-stroke-main last:border-b-0
                                 text-sm font-sans"
                    >
                      <span className="size-5 inline-flex items-center justify-center
                                       rounded-full bg-primary-main text-text-invert-primary
                                       text-xs font-bold shrink-0">
                        {i + 1}
                      </span>
                      <span className="font-mono tabular-nums text-text-primary">
                        {formatUtm(v.easting)}
                      </span>
                      <span className="text-text-secondary text-xs">E</span>
                      <span className="font-mono tabular-nums text-text-primary">
                        {formatUtm(v.northing)}
                      </span>
                      <span className="text-text-secondary text-xs">N</span>
                      {v.zone && (
                        <span className="ml-auto text-text-secondary text-xs">
                          {v.zone}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </dd>
            </div>
          )}
          {esLinea && (!c.verticesUtm || c.verticesUtm.length === 0) && (
            <Field
              label="Trazado (línea)"
              value={`${c.puntos!.length} vértices definidos`}
            />
          )}

          {c.fechaActualizacion && (
            <Field
              label="Última actualización"
              value={formatFecha(c.fechaActualizacion)}
            />
          )}
        </dl>

        {/* Identificador backend */}
        <div className="mt-auto pt-4 border-t border-input-stroke-main">
          <p className="text-text-secondary text-xs font-sans">
            ID interno: <span className="font-mono text-text-primary">{c.id}</span>
          </p>
        </div>
      </div>

      {/* Footer con acción de edición */}
      <div className="p-5 border-t border-input-stroke-main">
        <button
          type="button"
          onClick={() =>
            navigate(`/componentes/${encodeURIComponent(c.id)}/editar`)
          }
          className="w-full inline-flex items-center justify-center gap-2
                     px-4 py-2.5 rounded-lg bg-primary-main text-text-invert-primary
                     text-sm font-bold font-sans
                     hover:bg-primary-light transition-colors
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main focus-visible:ring-offset-2"
        >
          <Pencil className="size-4" strokeWidth={2} aria-hidden="true" />
          Editar componente
        </button>
      </div>
    </aside>
  );
}

/** Fila etiqueta/valor de la ficha técnica. */
function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-text-secondary text-xs font-sans uppercase tracking-wide">
        {label}
      </dt>
      <dd
        className={cn(
          'text-text-primary text-sm font-sans',
          mono && 'font-mono',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/** Formatea ISO a fecha legible (DD/MM/YYYY) sin aps de zona. */
function formatFecha(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const anio = d.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

/** Formatea UTM con separador de miles (sin decimales, los datos son 0.00). */
function formatUtm(v: number): string {
  return Math.round(v).toLocaleString('es-PE');
}
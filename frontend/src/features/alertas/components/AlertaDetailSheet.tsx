import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Pencil } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import {
  ESTADO_LABEL,
  type AlertaHistorica,
  type EstadoAlertaHistorica,
} from '../types';
import { ESTADO_VISUAL, UMBRAL_LABEL } from '../alerta-utils';
import { formatFechaHora, tiempoTranscurrido } from '../stepper-utils';

/**
 * AlertaDetailSheet — panel lateral derecho con el detalle de una alerta
 * en modo **sólo lectura** (visualización). Pensado para montarse al lado
 * de la tabla del histórico, igual que `ComponenteDetailSheet` para la
 * tabla de componentes. NO edita; el botón "Editar alerta" navega a la
 * vista de edición (GestionAlertas) en otra ruta.
 *
 * Modos de montaje (igual que `ComponenteDetailSheet`):
 *   - `floating=true`  → `absolute inset-y-0 right-0` (uso dentro de un
 *                        contenedor con posición relativa, p.ej. el mapa).
 *   - `floating=false` → layout estático dentro del flujo de la página
 *                        (uso en el histórico de alertas).
 *
 * Contenido (compacto, sólo lectura):
 *   - Header: tipo/estado + código (bold navy) + botón cerrar.
 *   - Body:   badges de estado/umbral + ficha de identificación (código,
 *              unidad operativa) + contexto meteorológico
 *              (fenómeno, fechas de creación / notificación / predicción,
 *              umbral) + historial compacto de transiciones.
 *   - Footer: botón "Editar alerta" → /alertas/:id/editar (id numérico
 *     del backend como preferido; cae a `id` string en mocks/legacy).
 */
interface AlertaDetailSheetProps {
  /** Alerta a mostrar. `null` indica sheet cerrado. */
  alerta: AlertaHistorica | null;
  onClose: () => void;
  /** `true` (default) → sheet flotante absolute; `false` → estático. */
  floating?: boolean;
}

export function AlertaDetailSheet({
  alerta,
  onClose,
  floating = true,
}: AlertaDetailSheetProps) {
  const navigate = useNavigate();

  // Cierra con Escape.
  useEffect(() => {
    if (!alerta) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [alerta, onClose]);

  if (!alerta) return null;
  const a = alerta;
  const visual = ESTADO_VISUAL[a.estado];

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-label={`Detalle de la alerta ${a.id}`}
      className={cn(
        floating
          ? 'absolute inset-y-0 right-0 z-[1000] w-full max-w-md'
          : 'h-full w-full max-w-md',
        'bg-background-main shadow-[-4px_0_8px_0px_rgba(0,0,0,0.20)] border-l border-input-stroke-main',
        'flex flex-col pointer-events-auto',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 p-5 border-b border-input-stroke-main">
        <div className="flex flex-col gap-1">
          <span className="text-text-secondary text-xs font-sans uppercase tracking-wide">
            {a.fenomeno}
          </span>
          <h2 className="text-primary-main text-lg font-bold font-sans leading-tight">
            {a.id}
          </h2>
          {a.unidadOperativa && (
            <span className="text-text-secondary text-sm font-sans">
              Unidad Operativa <strong className="text-text-primary">{a.unidadOperativa}</strong>
            </span>
          )}
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
        {/* Badges de estado + umbral */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'px-2 py-1 rounded-md text-xs font-sans font-bold inline-flex items-center gap-1.5',
              visual.badge,
            )}
          >
            <span className={cn('size-2 rounded-full', visual.dot)} />
            {ESTADO_LABEL[a.estado]}
          </span>
          <span className="px-2 py-1 rounded-md outline outline-1 outline-offset-[-1px] outline-input-stroke-main text-xs font-sans font-bold text-text-primary">
            Umbral {UMBRAL_LABEL[a.umbral]}
          </span>
        </div>

        {/* Ficha de identificación */}
        <section className="flex flex-col gap-3">
          <h3 className="text-text-primary text-sm font-bold font-sans">
            Información de identificación
          </h3>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-3">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tiempo transcurrido" value={tiempoTranscurrido(a.fechaCreacion)} />
              <Field
                label="Fecha de creación"
                value={formatFechaHora(a.fechaCreacion)}
                mono
              />
            </div>
          </dl>
        </section>

        {/* Contexto meteorológico */}
        <section className="flex flex-col gap-3">
          <h3 className="text-text-primary text-sm font-bold font-sans">
            Contexto meteorológico
          </h3>
          <dl className="grid grid-cols-1 gap-y-3">
            <Field label="Fenómeno climático" value={a.fenomeno} />
            <div className="grid grid-cols-2 gap-4">
              <Field label="Notificación" value={formatFechaHora(a.fechaNotificacion)} mono />
              <Field label="Predicción inicio" value={formatFechaHora(a.fechaPrediccionInicio)} mono />
            </div>
            {a.fechaRealInicio && (
              <Field label="Inicio real del fenómeno" value={formatFechaHora(a.fechaRealInicio)} mono />
            )}
            {a.fechaFinalizacion && (
              <Field label="Finalización" value={formatFechaHora(a.fechaFinalizacion)} mono />
            )}
          </dl>
        </section>

        {/* Histórico de transiciones (compacto) */}
        {a.historico.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-text-secondary text-xs font-sans uppercase tracking-wide">
              Histórico de estados ({a.historico.length})
            </h3>
            <ol className="flex flex-col gap-1 max-h-56 overflow-y-auto
                           border border-input-stroke-main rounded-lg overflow-hidden">
              {a.historico.map((h, i) => (
                <EstadoHistoricoItem key={i} index={i} estado={h.estado} fecha={h.fecha} />
              ))}
            </ol>
          </section>
        )}

        {/* Reportes si los hubiera (resumen de sólo lectura) */}
        {a.reporteDanos && a.reporteDanos.descripcion && (
          <section className="flex flex-col gap-1">
            <h3 className="text-text-secondary text-xs font-sans uppercase tracking-wide">
              Reporte de daños
            </h3>
            <p className="text-text-primary text-sm font-sans">
              {a.reporteDanos.huboDanos ? 'Hubo daños. ' : 'Sin daños. '}
              {a.reporteDanos.descripcion}
            </p>
          </section>
        )}
        {a.reporteAcciones && a.reporteAcciones.descripcion && (
          <section className="flex flex-col gap-1">
            <h3 className="text-text-secondary text-xs font-sans uppercase tracking-wide">
              Acciones tomadas
            </h3>
            <p className="text-text-primary text-sm font-sans">
              {a.reporteAcciones.descripcion}
            </p>
          </section>
        )}

        {/* Identificador backend */}
        <div className="mt-auto pt-4 border-t border-input-stroke-main">
          <p className="text-text-secondary text-xs font-sans">
            ID interno: <span className="font-mono text-text-primary">{a.id}</span>
          </p>
        </div>
      </div>

      {/* Footer con acción de edición */}
      <div className="p-5 border-t border-input-stroke-main">
        <button
          type="button"
          onClick={() => {
            const editId = a.backendId ?? a.id;
            navigate(`/alertas/${encodeURIComponent(editId)}/editar`);
          }}
          className="w-full inline-flex items-center justify-center gap-2
                     px-4 py-2.5 rounded-lg bg-primary-main text-text-invert-primary
                     text-sm font-bold font-sans
                     hover:bg-primary-light transition-colors
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main focus-visible:ring-offset-2"
        >
          <Pencil className="size-4" strokeWidth={2} aria-hidden="true" />
          Editar alerta
        </button>
      </div>
    </aside>
  );
}

/** Fila etiqueta/valor de la ficha. `mono` para fechas/códigos. */
function Field({
  label,
  value,
  mono = false,
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
          mono && 'font-mono tabular-nums',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/** Item del listado de transiciones de estado. */
function EstadoHistoricoItem({
  index,
  estado,
  fecha,
}: {
  index: number;
  estado: EstadoAlertaHistorica;
  fecha: string;
}) {
  const visual = ESTADO_VISUAL[estado];
  return (
    <li
      className="flex items-center gap-3 px-3 py-1.5
                 bg-background-main border-b border-input-stroke-main last:border-b-0
                 text-sm font-sans"
    >
      <span className="size-5 inline-flex items-center justify-center
                       rounded-full bg-primary-main text-text-invert-primary
                       text-xs font-bold shrink-0">
        {index + 1}
      </span>
      <span className={cn('size-2.5 rounded-full shrink-0', visual.dot)} />
      <span className="text-text-primary">{ESTADO_LABEL[estado]}</span>
      <span className="ml-auto font-mono tabular-nums text-text-secondary text-xs">
        {formatFechaHora(fecha)}
      </span>
    </li>
  );
}
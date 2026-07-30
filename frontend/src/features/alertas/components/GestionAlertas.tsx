import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiAlerts } from '@/services/apiAlerts';
import { mapAlertDetailToFrontend } from '../alertAdapters';
import {
  ESTADO_LABEL,
  NEXT_ESTADO,
  type AlertaHistorica,
  type EstadoAlertaHistorica,
} from '../types';
import {
  isReporteAccionesEditable,
  isReporteDanosEditable,
  shouldShowReporteAcciones,
  shouldShowReporteDanos,
} from '../reportes-utils';
import { Stepper } from './Stepper';
import { InfoCard } from './InfoCard';
import { ContextoCard } from './ContextoCard';
import { EstadoActualCard } from './EstadoActualCard';
import { ReporteCard } from './ReporteCard';
import { StatusConfirmDialog } from './StatusConfirmDialog';
import { cn } from '@/shared/lib/cn';

/**
 * GestionAlertas — página de detalle y edición de una alerta histórica.
 *
 * Layout (según Figma):
 *
 *   ┌─ Stepper (3 fases) ────────────────────────────────────────────┐
 *   ┌─ InfoCard ───────┐  ┌─ EstadoActualCard ──────────────────────┐
 *   │                  │  │                                          │
 *   ├─ ContextoCard ───┤  ├─ ReporteCard (daños, condicional) ──────┤
 *   │                  │  ├─ ReporteCard (acciones, condicional) ────┤
 *   └──────────────────┘  └───────────────────────────────────────────┘
 *   ┌─ Footer: Cancelar · Guardar y Cambiar Estado ─────────────────┐
 *
 * Comportamiento:
 *   - "Cancelar" vuelve al histórico de alertas (sin guardar).
 *   - "Guardar y Cambiar Estado" abre un modal tintado con el color del
 *     siguiente estado del flujo; el texto indica a qué fase transiciona.
 *   - Confirmación ejecuta PATCH al endpoint de transiciones.
 */

/**
 * Mapea un `EstadoAlertaHistorica` del frontend al payload que espera
 * el endpoint de transiciones del backend.
 */
function buildTransitionPayload(
  siguiente: EstadoAlertaHistorica,
  reporteDanos: string,
  reporteAcciones: string,
) {
  const payload: Record<string, unknown> = {};

  // Estado (status_name)
  if (siguiente === 'confirmado' || siguiente === 'en-espera-reporte' ||
      siguiente === 'en-proceso-atencion' || siguiente === 'atendido') {
    payload.status_name = 'Confirmado';
  } else if (siguiente === 'no-confirmado') {
    payload.status_name = 'No Confirmado';
  }

  // Fase (phase_name)
  if (siguiente === 'en-espera-reporte') {
    payload.phase_name = 'En Espera de Reporte';
  } else if (siguiente === 'en-proceso-atencion') {
    payload.phase_name = 'En Proceso de Atención';
  } else if (siguiente === 'atendido') {
    payload.phase_name = 'Atendido';
  }

  // Reporte de daños (solo cuando estamos en EN_ESPERA_REPORTE → siguiente paso)
  if (reporteDanos) {
    payload.has_damage = true;
    payload.damage_report = reporteDanos;
  }

  // Acciones tomadas (solo cuando estamos pasando a ATENDIDO)
  if (reporteAcciones) {
    payload.taken_actions = reporteAcciones;
  }

  return payload;
}

export function GestionAlertas() {
  const { id: alertCode } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [alerta, setAlerta] = useState<AlertaHistorica | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reporteDanos, setReporteDanos] = useState<string>('');
  const [reporteAcciones, setReporteAcciones] = useState<string>('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Carga inicial del detalle de la alerta.
  useEffect(() => {
    if (!alertCode) return;
    setIsLoading(true);
    setError(null);
    apiAlerts.getAlertDetail(alertCode)
      .then((data) => {
        const mapped = mapAlertDetailToFrontend(data);
        setAlerta(mapped);
        setReporteDanos(mapped.reporteDanos?.descripcion ?? '');
        setReporteAcciones(mapped.reporteAcciones?.descripcion ?? '');
      })
      .catch((err) => {
        console.error('Error cargando alerta:', err);
        setError('No se pudo cargar la alerta. Verifica que el código sea válido.');
      })
      .finally(() => setIsLoading(false));
  }, [alertCode]);

  // — Estados de carga / error —
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-text-secondary text-sm font-sans">Cargando alerta...</p>
      </div>
    );
  }

  if (error || !alerta) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <p className="text-text-secondary text-sm font-sans">{error ?? 'Alerta no encontrada.'}</p>
        <button
          type="button"
          onClick={() => navigate('/alertas/gestion')}
          className="px-6 py-2.5 rounded-xl outline outline-1 outline-offset-[-1px] outline-button-stroke text-text-primary text-sm font-medium font-sans
                     hover:bg-primary-states-hover-main transition-colors"
        >
          Volver al histórico
        </button>
      </div>
    );
  }

  const siguiente = NEXT_ESTADO[alerta.estado] ?? alerta.estado;
  const isEstadoFinal = siguiente === alerta.estado;

  const siguienteLabel = ESTADO_LABEL[siguiente];
  const siguienteColorClass = COLOR_CLASSES[siguiente];

  // Reportes condicionales.
  const showDanos = shouldShowReporteDanos(alerta.estado);
  const showAcciones = shouldShowReporteAcciones(alerta.estado);
  const danosReadOnly = !isReporteDanosEditable(alerta.estado);
  const accionesReadOnly = !isReporteAccionesEditable(alerta.estado);

  function handleGuardarYCambiarEstado() {
    setShowConfirm(true);
  }

  async function handleConfirmarTransicion() {
    if (!alertCode) return;
    setIsSaving(true);
    try {
      const payload = buildTransitionPayload(siguiente, reporteDanos, reporteAcciones);

      // Un solo PATCH al endpoint de transiciones (el backend FSM maneja
      // la lógica completa: cambia status, phase, y crea el AlertResult).
      await apiAlerts.transitionState(alertCode, payload as any);

      // Recargar datos desde el backend para reflejar el nuevo estado.
      const data = await apiAlerts.getAlertDetail(alertCode);
      const mapped = mapAlertDetailToFrontend(data);
      setAlerta(mapped);
      setReporteDanos(mapped.reporteDanos?.descripcion ?? '');
      setReporteAcciones(mapped.reporteAcciones?.descripcion ?? '');
      setShowConfirm(false);
    } catch (err) {
      console.error('Error transicionando la alerta:', err);
      window.alert('Ocurrió un error al guardar los cambios.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto p-5 flex flex-col items-start gap-5 max-w-[30000px]">
      {/* ── Stepper ─────────────────────────────────────────────────── */}
      <Stepper alerta={alerta} />

      {/* ── Body (2 columnas) ──────────────────────────────────────── */}
      <div className="self-stretch inline-flex justify-start items-start gap-5">
        {/* Columna izquierda (480px aprox, fija) */}
        <div className="w-[474px] inline-flex flex-col items-center gap-5">
          <InfoCard alerta={alerta} />
          <ContextoCard alerta={alerta} />
        </div>

        {/* Columna derecha (resto) */}
        <div className="flex-1 inline-flex flex-col items-start gap-5">
          <EstadoActualCard alerta={alerta} />

          {showDanos && (
            <ReporteCard
              id="danos"
              title="Reporte de daños"
              description="Descripción simple de los daños ocurridos. Máx 500 caracteres."
              value={reporteDanos}
              onChange={setReporteDanos}
              readOnly={danosReadOnly}
              placeholder="Descripción simple de los daños ocurridos."
            />
          )}

          {showAcciones && (
            <ReporteCard
              id="acciones"
              title="Reporte de acciones tomadas"
              description="Descripción simple de las medidas tomadas para resolver el incidente."
              value={reporteAcciones}
              onChange={setReporteAcciones}
              readOnly={accionesReadOnly}
              placeholder="Descripción simple de las medidas tomadas para resolver el incidente."
            />
          )}
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <div className="self-stretch h-14 pb-4 inline-flex justify-end items-center gap-3">
        {/* Cancelar → vuelve al mapa de alertas */}
        <button
          type="button"
          onClick={() => navigate('/alertas/gestion')}
          className="px-6 py-2.5 rounded-xl outline outline-1 outline-offset-[-1px] outline-button-stroke text-text-primary text-sm font-medium font-sans
                     hover:bg-primary-states-hover-main transition-colors
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main focus-visible:ring-offset-2"
        >
          Cancelar
        </button>

        {/* Guardar y Cambiar Estado → abre modal de confirmación tintado */}
        <button
          type="button"
          onClick={handleGuardarYCambiarEstado}
          disabled={isEstadoFinal || isSaving}
          className={cn(
            'px-6 py-2.5 rounded-xl inline-flex justify-start items-center gap-2',
            'bg-primary-main text-text-invert-primary text-sm font-medium font-sans',
            'hover:bg-primary-light transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main focus-visible:ring-offset-2',
            (isEstadoFinal || isSaving) && 'opacity-50 cursor-not-allowed',
          )}
        >
          <svg viewBox="0 0 16 16" className="size-4 text-text-invert-primary" aria-hidden="true">
            <path
              d="M3 7L7 11L13 4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.33"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {isSaving ? 'Guardando...' : isEstadoFinal ? 'Estado final alcanzado' : 'Guardar y Cambiar Estado'}
        </button>
      </div>

      {/* ── Modal de confirmación tintado ──────────────────────────── */}
      <StatusConfirmDialog
        open={showConfirm}
        title="Confirmar cambio de estado"
        message={
          <>
            Se guardarán los cambios y la alerta pasará a la fase:{' '}
            <strong className="font-bold">{siguienteLabel}</strong>.
          </>
        }
        confirmText={`Guardar y pasar a ${siguienteLabel}`}
        cancelText="Cancelar"
        onConfirm={handleConfirmarTransicion}
        onClose={() => setShowConfirm(false)}
        confirmColorClass={siguienteColorClass}
      />
    </div>
  );
}

/**
 * Clases Tailwind para el botón "Confirmar" del modal, según el color
 * de marca del siguiente estado. Tomamos los tokens `alerts.status.*`.
 */
const COLOR_CLASSES: Record<EstadoAlertaHistorica, string> = {
  'predicho': 'bg-alerts-status-predicho text-text-primary hover:opacity-80 focus-visible:ring-alerts-status-predicho',
  'en-espera-confirmacion': 'bg-alerts-status-en-espera-confirmacion text-text-primary hover:opacity-80 focus-visible:ring-alerts-status-en-espera-confirmacion',
  'no-confirmado': 'bg-alerts-status-no-confirmado text-text-invert-primary hover:opacity-80 focus-visible:ring-alerts-status-no-confirmado',
  'confirmado': 'bg-alerts-status-confirmado-reporte text-text-invert-primary hover:opacity-80 focus-visible:ring-alerts-status-confirmado-reporte',
  'en-espera-reporte': 'bg-alerts-status-confirmado-reporte text-text-invert-primary hover:opacity-80 focus-visible:ring-alerts-status-confirmado-reporte',
  'en-proceso-atencion': 'bg-alerts-status-en-proceso-atencion text-text-invert-primary hover:opacity-80 focus-visible:ring-alerts-status-en-proceso-atencion',
  'atendido': 'bg-alerts-status-atendido text-text-primary hover:opacity-80 focus-visible:ring-alerts-status-atendido',
};
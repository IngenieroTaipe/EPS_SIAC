import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
 *   - Confirmación ejecuta PATCH (mockeado: actualiza estado localmente).
 */
interface GestionAlertasProps {
  /** Alerta a editar (default: primer mock del histórico). */
  initialAlerta?: AlertaHistorica;
}

export function GestionAlertas({ initialAlerta }: GestionAlertasProps) {
  const navigate = useNavigate();
  const [alerta, setAlerta] = useState<AlertaHistorica>(
    initialAlerta ?? {
      id: 'PK-0001',
      unidadOperativa: 'Pichanaqui',
      distrito: 'Pichanaqui',
      estado: 'en-proceso-atencion',
      fenomeno: 'Lluvia',
      umbral: 'moderadamente-lluvioso',
      fechaCreacion: '2026-06-22T15:40:00-05:00',
      fechaNotificacion: '2026-06-22T15:45:00-05:00',
      fechaPrediccionInicio: '2026-06-22T16:45:00-05:00',
      fechaRealInicio: '2026-06-22T16:50:00-05:00',
      historico: [
        { estado: 'predicho', fecha: '2026-06-22T15:45:00-05:00' },
        { estado: 'en-espera-confirmacion', fecha: '2026-06-22T16:45:00-05:00' },
        { estado: 'confirmado', fecha: '2026-06-22T17:10:00-05:00' },
        { estado: 'en-espera-reporte', fecha: '2026-06-22T17:30:00-05:00' },
        { estado: 'en-proceso-atencion', fecha: '2026-06-22T18:00:00-05:00' },
      ],
      reporteDanos: {
        descripcion:
          'Inundación menor en captación Río Pichanaqui. Sedimentos en el reservorio central.',
        huboDanos: true,
        fechaRegistro: '2026-06-22T17:30:00-05:00',
      },
    },
  );
  const [reporteDanos, setReporteDanos] = useState<string>(
    alerta.reporteDanos?.descripcion ?? '',
  );
  const [reporteAcciones, setReporteAcciones] = useState<string>(
    alerta.reporteAcciones?.descripcion ?? '',
  );
  const [showConfirm, setShowConfirm] = useState(false);

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

  function handleConfirmarTransicion() {
    // Mock: actualizar estado localmente. El backend hará el PATCH real.
    const now = new Date().toISOString();
    const updatedHistorico = [...alerta.historico, { estado: siguiente, fecha: now }];
    setAlerta({
      ...alerta,
      estado: siguiente as EstadoAlertaHistorica,
      historico: updatedHistorico,
      reporteDanos: reporteDanos
        ? {
            descripcion: reporteDanos,
            huboDanos: true, // Mock; lo decide el usuario en EN_ESPERA_REPORTE.
            fechaRegistro: alerta.reporteDanos?.fechaRegistro ?? now,
          }
        : alerta.reporteDanos,
      reporteAcciones: reporteAcciones
        ? {
            descripcion: reporteAcciones,
            fechaFinalizacion: now,
          }
        : alerta.reporteAcciones,
    });
    setShowConfirm(false);
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
          disabled={isEstadoFinal}
          className={cn(
            'px-6 py-2.5 rounded-xl inline-flex justify-start items-center gap-2',
            'bg-primary-main text-text-invert-primary text-sm font-medium font-sans',
            'hover:bg-primary-light transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main focus-visible:ring-offset-2',
            isEstadoFinal && 'opacity-50 cursor-not-allowed',
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
          {isEstadoFinal ? 'Estado final alcanzado' : 'Guardar y Cambiar Estado'}
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
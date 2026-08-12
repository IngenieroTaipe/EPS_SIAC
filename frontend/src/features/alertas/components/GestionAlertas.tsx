import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiAlerts, type AlertTransitionPayload } from '@/services/apiAlerts';
import { apiOrganization } from '@/services/apiOrganization';
import {
  mapAlertDetailToFrontend,
  buildBranchByUbigeo,
} from '../alertAdapters';
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
 * Construye el payload para `/alerts/transitions/<id>/` (PATCH).
 *
 * El backend cambió `AlertTransitionSerializer.ChoiceField`:
 * los `status_name`/`phase_name` van en MAYÚSCULAS (mismo nombre
 * que el `AlertStatus.name`/`AlertPhase.name` en la BD).
 *
 * Reglas:
 *   predicho                       → SIN acción manual (la hace Celery
 *                                    cuando start_time_utc <= now). El
 *                                    botón se deshabilita por isReadOnly
 *                                    en GestionAlertas — este caso no
 *                                    debería dispararse, pero dejamos
 *                                    el case como noop defensivo.
 *   en-espera-confirmacion         → SIN acción manual directa porque
 *                                    la FSM rule rechaza mandar CONFIRMADO
 *                                    desde PREDICHO. (El usuario
 *                                    realmente "Confirma" la alerta
 *                                    cuando ya está en ESPERA, lo que
 *                                    va a 'confirmado' → véase más abajo.)
 *                                    Se deja como noop por ahora.
 *   confirmado                     → status=CONFIRMADO, phase=EN ESPERA DE REPORTE
 *   en-espera-reporte              → status=CONFIRMADO, phase=EN PROCESO DE ATENCIÓN
 *   en-proceso-atencion            → status=CONFIRMADO, phase=ATENDIDO
 *   no-confirmado                  → status=NO CONFIRMADO
 *
 * IMPORTANTE: el ChoiceField de `status_name` en el backend solo acepta
 * "CONFIRMADO" o "NO CONFIRMADO" — no soporta "EN ESPERA DE CONFIRMACIÓN".
 * Por eso la transición predicho→ en-espera-confirmacion no se puede
 * hacer por HTTP (la hace Celery internamente con bypass del serializer).
 *
 * Siempre mandamos `phase_name` cuando `status_name == CONFIRMADO`
 * porque el backend referencia `cls.DEFAULT_CONFIRMED_PHASE` que no
 * existe → AttributeError. Bug pendiente del BE.
 *
 * Adicionalmente: el backend valida `if attrs.get('real_start_time') > now`
 * sin chequear None → TypeError si NO se envía real_start_time. Mandamos
 * el instante actual siempre que sea CONFIRMADO (workaround BE).
 */
function buildTransitionPayload(
  siguiente: EstadoAlertaHistorica,
  reporteDanos: string,
  reporteAcciones: string,
): AlertTransitionPayload {
  const payload: AlertTransitionPayload = {};

  // 'predicho' y 'en-espera-confirmacion' se manejan fuera (botón
  // deshabilitado). No se construye payload útil aquí; devolvemos vacío.
  if (siguiente === 'predicho' || siguiente === 'en-espera-confirmacion') {
    return payload;
  }

  // Estado (status_name)
  if (siguiente === 'no-confirmado') {
    payload.status_name = 'NO CONFIRMADO';
  } else {
    // confirmado / en-espera-reporte / en-proceso-atencion / atendido
    payload.status_name = 'CONFIRMADO';
  }

  // Fase (phase_name) — mandarla siempre para evitar el path
  // `cls.DEFAULT_CONFIRMED_PHASE` (AttributeError) en el backend cuando
  // status_name == CONFIRMADO. Cada estado destino del frontend mapea a
  // una fase concreta del backend.
  switch (siguiente) {
    case 'confirmado':
      // Primera confirmación (auto-asignada a EN ESPERA DE REPORTE por
      // el backend, hoy explota por bug de `DEFAULT_CONFIRMED_PHASE`,
      // así que mandamos phase explícito).
      payload.phase_name = 'EN ESPERA DE REPORTE';
      break;
    case 'en-espera-reporte':
      // En la práctica no se invoca desde la UI (NEXT_ESTADO['confirmado']
      // = 'en-espera-reporte' nunca se dispara porque tras confirmar ya
      // quedas en ese estado tras reload); mantenido por completitud.
      payload.phase_name = 'EN ESPERA DE REPORTE';
      break;
    case 'en-proceso-atencion':
      payload.phase_name = 'EN PROCESO DE ATENCIÓN';
      break;
    case 'atendido':
      payload.phase_name = 'ATENDIDO';
      break;
  }

  // Reporte de daños + Acciones tomadas: SOLO se envían en el PATCH final
  // hacia ATENDIDO. Mandarlos en transiciones intermedias (p. ej. hacia
  // EN PROCESO DE ATENCIÓN) choca con el bug del backend en
  // `AlertTransitionSerializer.validate` línea 499: exige `taken_actions`
  // siempre que `damage_report` esté presente, sin importar la fase.
  // Por eso el daño se edita en `en-espera-reporte` (editable), se queda
  // en state local del componente al avanzar a `en-proceso-atencion`
  // (donde se vuelve read-only), y se persiste junto con las acciones
  // al cerrar como `atendido`. Si el usuario recarga en medio, pierde
  // el daño no guardado (workaround temporal mientras bug del BE no
  // se arregle).
  if (siguiente === 'atendido') {
    if (reporteDanos.trim()) {
      payload.has_damage = true;
      payload.damage_report = reporteDanos.trim();
    }
    if (reporteAcciones.trim()) {
      payload.taken_actions = reporteAcciones.trim();
    }
  }

  // Workaround BE bug: `serializers.py:502` compara real_start_time > now
  // sin chequear None → TypeError. Mandamos el instante actual cuando
  // vamos a CONFIRMADO (única rama donde el backend lo consume).
  if (payload.status_name === 'CONFIRMADO' && payload.real_start_time == null) {
    payload.real_start_time = new Date().toISOString();
  }

  return payload;
}

export function GestionAlertas() {
  // `id` del route param: ahora debe ser el backendId (PK) porque el
  // backend cambió lookup_field. Como viene por useParams, es string.
  // Para llamar getAlertDetail/transitionState se castea a number
  // cuando es numérico, o se pasa como string si viene de un mock/legacy.
  const { id: alertIdParam } = useParams<{ id: string }>();
  // Normaliza a number cuando sea posible (mejor para el lookup_field='id').
  const alertBackendId = (() => {
    const n = Number(alertIdParam);
    return Number.isFinite(n) && n > 0 ? n : alertIdParam;
  })();
  const navigate = useNavigate();
  const [alerta, setAlerta] = useState<AlertaHistorica | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mapa de UBIGEO → nombre de la Unidad Operativa (Branch). Se carga en
  // paralelo al detalle de la alerta para poder resolver el campo
  // "Unidad Operativa" a partir de los `affected_districts[].ubigeo`.
  const [branchByUbigeo, setBranchByUbigeo] = useState<Map<string, string>>(
    () => new Map(),
  );

  const [reporteDanos, setReporteDanos] = useState<string>('');
  const [reporteAcciones, setReporteAcciones] = useState<string>('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Override del siguiente estado destino (usado por botones secundarios
  // como "Marcar como No Confirmado"). Debe vivir aquí, antes de los early
  // returns, para respetar rules-of-hooks.
  const [siguienteOverride, setSiguienteOverride] = useState<EstadoAlertaHistorica | null>(null);

  // ── Persistencia temporal de reportes en sessionStorage ──────────────
  // El backend tiene un bug en `AlertTransitionSerializer.validate` (línea
  // 499) que exige `taken_actions` siempre que se mande `damage_report`,
  // sin importar la fase. Por eso el frontend solo persiste daño y
  // acciones en el PATCH final a `ATENDIDO`. Mientras tanto, lo que el
  // usuario escribe en `en-espera-reporte` y `en-proceso-atencion` vive
  // solo en state React → se pierde si recarga.
  //
  // Para evitar la pérdida (UX fea: "escribí el daño, avancé de fase,
  // recargué y ya no veo mi daño"), guardamos el borrador en
  // `sessionStorage` bajo claves por `alertBackendId`. Cuando la alerta
  // finalmente queda en `atendido` y el backend persiste el AlertResult,
  // el `mapAlertDetailToFrontend` lee `result.damage_report` / `result.
  // taken_actions` y esos valores prevalecen sobre el borrador (se
  // considera "oficial"). Mosca: si la alerta ya está sellada, no
  // deberíamos usar el borrador aunque quede en sessionStorage — por eso
  // el `if (!mapped.reporteDanos?.descripcion)` más abajo.
  const reporteDanosKey = alertBackendId ? `eps_alert_dmg_${alertBackendId}` : '';
  const reporteAccionesKey = alertBackendId ? `eps_alert_act_${alertBackendId}` : '';

  function readDraft(key: string): string {
    if (!key) return '';
    try { return sessionStorage.getItem(key) ?? ''; }
    catch { return ''; }
  }
  function writeDraft(key: string, value: string): void {
    if (!key) return;
    try {
      if (value) sessionStorage.setItem(key, value);
      else sessionStorage.removeItem(key);
    } catch { /* noop */ }
  }

  // Carga inicial del detalle de la alerta + branches (en paralelo).
  useEffect(() => {
    if (!alertBackendId) return;
    /* eslint-disable react-hooks/set-state-in-effect -- secuencia de
       carga (loading true → fetch → loading false), patrón canónico. */
    setIsLoading(true);
    setError(null);

    // Carga branches una sola vez (no dependen de alertId). Si fallan,
    // el detalle cargará igual y la UO mostrará '—'.
    const branchesPromise = apiOrganization
      .listBranches({ status: true })
      .then((branches) => {
        const map = buildBranchByUbigeo(branches);
        setBranchByUbigeo(map);
        return map; // pasamos el mapa al siguiente .then sin esperar al state
      })
      .catch((err) => {
        console.error('Error cargando unidades operativas:', err);
        return new Map<string, string>(); // fallback vacío
      });

    apiAlerts.getAlertDetail(alertBackendId)
      .then(async (data) => {
        // Esperar a que branchesPromise resuelva con el mapa (ya seteado
        // o fallback). Así evitamos race conditions entre setState y el
        // mapeo.
        const map = await branchesPromise;
        const mapped = mapAlertDetailToFrontend(data, map);
        setAlerta(mapped);
        // Si el backend ya persistió el reporte (alerta en/atendida o
        // en-proceso-atencion con AlertResult previo), ese valor es
        // oficial y prevalece. Si NO (venimos de `en-espera-reporte` sin
        // haber mandado daño todavía), restauramos el borrador del
        // sessionStorage para que el operador no pierda lo que escribió.
        const persistidoDanos = mapped.reporteDanos?.descripcion ?? '';
        const persistidoAcciones = mapped.reporteAcciones?.descripcion ?? '';
        setReporteDanos(persistidoDanos || readDraft(reporteDanosKey));
        setReporteAcciones(persistidoAcciones || readDraft(reporteAccionesKey));
      })
      .catch((err) => {
        console.error('Error cargando alerta:', err);
        setError('No se pudo cargar la alerta. Verifica que el código sea válido.');
      })
      .finally(() => setIsLoading(false));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [alertBackendId, reporteDanosKey, reporteAccionesKey]);

  // Sincronizar borradores con sessionStorage cada vez que cambian
  // (solo mientras la alerta NO esté sellada — en `atendido` el backend
  // ya persistió y el draft se limpia para evitar confusiones).
  useEffect(() => {
    if (!alerta || alerta.estado === 'atendido' || alerta.estado === 'no-confirmado') return;
    writeDraft(reporteDanosKey, reporteDanos);
  }, [reporteDanos, reporteDanosKey, alerta]);

  useEffect(() => {
    if (!alerta || alerta.estado === 'atendido' || alerta.estado === 'no-confirmado') return;
    writeDraft(reporteAccionesKey, reporteAcciones);
  }, [reporteAcciones, reporteAccionesKey, alerta]);

  // Cuando la alerta queda sellada (atendido / no-confirmado), borramos
  // los borradores del sessionStorage: ya no son necesarios, el backend
  // persistió (o descartó) el reporte oficial.
  useEffect(() => {
    if (!alerta) return;
    if (alerta.estado === 'atendido' || alerta.estado === 'no-confirmado') {
      if (reporteDanosKey) sessionStorage.removeItem(reporteDanosKey);
      if (reporteAccionesKey) sessionStorage.removeItem(reporteAccionesKey);
    }
  }, [alerta, reporteDanosKey, reporteAccionesKey]);

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

  const siguienteBase = NEXT_ESTADO[alerta.estado] ?? alerta.estado;
  // Si el operador presionó un botón secundario (p. ej. "Marcar como No
  // Confirmado"), `siguienteOverride` decide el destino. Si no, cae al
  // siguiente natural según NEXT_ESTADO.
  const siguiente = siguienteOverride ?? siguienteBase;
  const isEstadoFinal = siguienteBase === alerta.estado;

  // Transición automática: las alertas en 'predicho' pasan a
  // 'en-espera-confirmacion' SOLO vía Celery cuando start_time_utc <=
  // now() (ver tasks.py:209-222). El ChoiceField del backend no acepta
  // "EN ESPERA DE CONFIRMACIÓN" y la FSM rule lo exige → no se puede
  // hacer a mano. Deshabilitamos el botón para evitar el error 500.
  const isTransicionAutomatica = alerta.estado === 'predicho';
  const isBotonDeshabilitado = isEstadoFinal || isTransicionAutomatica || isSaving;
  const botonLabel = isSaving
    ? 'Guardando...'
    : isTransicionAutomatica
      ? 'Transición automática (Celery)'
      : isEstadoFinal
        ? 'Estado final alcanzado'
        : 'Guardar y Cambiar Estado';

  // El botón "Marcar como No Confirmado" solo aparece en en-espera-confirmacion.
  // Es el operador diciendo "la alerta no se confirmó, descartar". El
  // backend permite este paso vía PATCH con status_name=NO CONFIRMADO.
  const canNoConfirmar = alerta.estado === 'en-espera-confirmacion';

  const siguienteLabel = ESTADO_LABEL[siguiente];
  const siguienteColorClass = COLOR_CLASSES[siguiente];

  // Reportes condicionales.
  const showDanos = shouldShowReporteDanos(alerta.estado);
  const showAcciones = shouldShowReporteAcciones(alerta.estado);
  const danosReadOnly = !isReporteDanosEditable(alerta.estado);
  const accionesReadOnly = !isReporteAccionesEditable(alerta.estado);

  function handleGuardarYCambiarEstado() {
    setSiguienteOverride(null);
    setShowConfirm(true);
  }

  // Botón "Marcar como No Confirmado" en en-espera-confirmacion: setea
  // el override y abre el mismo modal de confirmación. El modal usa
  // `siguiente` que ahora será 'no-confirmado'.
  function handleNoConfirmar() {
    setSiguienteOverride('no-confirmado');
    setShowConfirm(true);
  }

  async function handleConfirmarTransicion() {
    if (!alertBackendId) return;
    setIsSaving(true);
    try {
      const payload = buildTransitionPayload(siguiente, reporteDanos, reporteAcciones);

      // Un solo PATCH al endpoint de transiciones (el backend FSM maneja
      // la lógica completa: cambia status, phase, y crea el AlertResult).
      await apiAlerts.transitionState(alertBackendId, payload);

      // Recargar datos desde el backend para reflejar el nuevo estado.
      const data = await apiAlerts.getAlertDetail(alertBackendId);
      const mapped = mapAlertDetailToFrontend(data, branchByUbigeo);
      setAlerta(mapped);
      // Si el backend persistió el reporte (alerta ya ATENDIDA) usamos
      // ese valor oficial. Si no (transición intermedia sin persistir
      // daño), mantenemos el state actual para que el operador siga
      // viendo lo que escribió. Los useEffect más abajo se encargan de
      // sincronizar el draft con sessionStorage.
      const persistidoDanos = mapped.reporteDanos?.descripcion ?? '';
      const persistidoAcciones = mapped.reporteAcciones?.descripcion ?? '';
      setReporteDanos(persistidoDanos || reporteDanos);
      setReporteAcciones(persistidoAcciones || reporteAcciones);
      // Si la alerta acaba de llegar a ATENDIDO, limpiamos el draft ya
      // que el backend ya persistió el AlertResult definitivo.
      if (mapped.estado === 'atendido' || mapped.estado === 'no-confirmado') {
        if (reporteDanosKey) sessionStorage.removeItem(reporteDanosKey);
        if (reporteAccionesKey) sessionStorage.removeItem(reporteAccionesKey);
      }
      setSiguienteOverride(null);
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

        {/* "Marcar como No Confirmado" — solo en en-espera-confirmacion.
            Acción secundaria (outline gris) para distinguirla del CTA
            principal "Guardar y Cambiar Estado". Usa el mismo modal de
            confirmación pero tintado con el color de 'no-confirmado'. */}
        {canNoConfirmar && (
          <button
            type="button"
            onClick={handleNoConfirmar}
            disabled={isSaving}
            className={cn(
              'px-6 py-2.5 rounded-xl inline-flex justify-start items-center gap-2',
              'bg-alerts-status-no-confirmado text-text-invert-primary',
              'text-sm font-medium font-sans',
              'hover:opacity-80 transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-alerts-status-no-confirmado focus-visible:ring-offset-2',
              isSaving && 'opacity-50 cursor-not-allowed',
            )}
          >
            Marcar como No Confirmado
          </button>
        )}

        {/* Guardar y Cambiar Estado → abre modal de confirmación tintado */}
        <button
          type="button"
          onClick={handleGuardarYCambiarEstado}
          disabled={isBotonDeshabilitado}
          className={cn(
            'px-6 py-2.5 rounded-xl inline-flex justify-start items-center gap-2',
            'bg-primary-main text-text-invert-primary text-sm font-medium font-sans',
            'hover:bg-primary-light transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main focus-visible:ring-offset-2',
            isBotonDeshabilitado && 'opacity-50 cursor-not-allowed',
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
          {botonLabel}
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
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertsTable } from '@/features/alertas/components/AlertsTable';
import { ESTADO_LABEL, type AlertaHistorica, type EstadoAlertaHistorica } from '@/features/alertas/types';
import { apiAlerts } from '@/services/apiAlerts';
import { mapAlertListToFrontend } from '@/features/alertas/alertAdapters';
import { cn } from '@/shared/lib/cn';
import { useUnidadOperativa } from '@/shared/context/useUnidadOperativa';
import {
  UNIDADES_OPERATIVAS,
  UNIDAD_TODAS,
} from '@/shared/context/UnidadOperativaContext';

/**
 * Compara una unidad del mock (p.ej. "Pichanaqui") con el nombre del
 * contexto (p.ej. "Pichanaqui-Sangani") usando la "raíz" antes del
 * guion, para evitar duplicar de la lista de unidades en esta página.
 * Mientras el mock usa nombres cortos heredados, el contexto usa los
 * nombres canónicos; esto los reconcilia sin tocar el mock.
 */
function mismaUnidad(unidadAlerta: string, selectedNombre: string): boolean {
  if (selectedNombre === UNIDAD_TODAS) return true;
  const rootSel = selectedNombre.split('-')[0];
  const rootAlerta = unidadAlerta.split('-')[0];
  return rootSel === rootAlerta;
}

/** Estados se pueden filtrar individualmente (checkbox list). */
const ESTADOS_FILTRABLES: EstadoAlertaHistorica[] = [
  'predicho',
  'en-espera-confirmacion',
  'no-confirmado',
  'confirmado',
  'en-espera-reporte',
  'en-proceso-atencion',
  'atendido',
];

/** Color del badge por estado (para el indicador del checkbox). */
const ESTADO_DOT: Record<EstadoAlertaHistorica, string> = {
  'predicho': 'bg-alerts-status-predicho',
  'en-espera-confirmacion': 'bg-alerts-status-en-espera-confirmacion',
  'no-confirmado': 'bg-alerts-status-no-confirmado',
  'confirmado': 'bg-alerts-status-confirmado-reporte',
  'en-espera-reporte': 'bg-alerts-status-confirmado-reporte',
  'en-proceso-atencion': 'bg-alerts-status-en-proceso-atencion',
  'atendido': 'bg-alerts-status-atendido',
};

/**
 * HistoricoAlertasPage — vista de tabla histórica con filtros.
 *
 * Filtros (en barra superior):
 *   - Unidad operativa (select único; "Todas" = sin filtro).
 *   - Estados (lista de checkboxes con dot de color).
 *   - Intervalo de fechas: desde / hasta. La fecha de comparación es
 *     `fechaCreacion` (cuando se generó la alerta histórica). Motivo
 *     porque esa fecha inicia el ciclo de vida de la alerta y es
 *     consistente para todos los estados. Si más tarde el backend
 *     expone otras fechas relevantes (`fechaFinalizacion`), se puede
 *     añadir un selector "Comparar por: creación / notificación / predicción / cierre".
 */
export function HistoricoAlertasPage() {
  const [searchParams] = useSearchParams();
  const preselectId = searchParams.get('id');

  const { selectedNombre, setSelectedNombre } = useUnidadOperativa();

  const [alertas, setAlertas] = useState<AlertaHistorica[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [estadosSeleccionados, setEstadosSeleccionados] = useState<Set<EstadoAlertaHistorica>>(
    () => new Set(ESTADOS_FILTRABLES),
  );
  const [desde, setDesde] = useState<string>('');
  const [hasta, setHasta] = useState<string>('');

  // ID seleccionado en la tabla (para resaltar fila si hace falta). Si
  // llega ?id= desde el mapa (botón view del AlertaRow), pre-selecciona.
  const [selectedId, setSelectedId] = useState<string | null>(preselectId);

  // Cargar alertas del backend al montar.
  useEffect(() => {
    setIsLoading(true);
    apiAlerts.listAlerts()
      .then((items) => {
        const mapped = items.map(mapAlertListToFrontend);
        setAlertas(mapped);
      })
      .catch((err) => console.error('Error cargando alertas:', err))
      .finally(() => setIsLoading(false));
  }, []);

  // Toggle real: clic en fila seleccionada la deselecciona (igual que las
  // demás vistas que usan AlertsTable/ComponentsTable).
  function handleToggleSelect(id: string) {
    setSelectedId((prev) => (prev === id ? null : id));
  }

  // Aplicar filtros sobre los datos ya cargados.
  const alertasFiltradas = useMemo(() => {
    return alertas.filter((a) => {
      if (!mismaUnidad(a.unidadOperativa, selectedNombre)) return false;
      if (!estadosSeleccionados.has(a.estado)) return false;
      const fechaCreacion = new Date(a.fechaCreacion).getTime();
      if (desde) {
        const desdeTs = new Date(`${desde}T00:00:00`).getTime();
        if (fechaCreacion < desdeTs) return false;
      }
      if (hasta) {
        const hastaTs = new Date(`${hasta}T23:59:59`).getTime();
        if (fechaCreacion > hastaTs) return false;
      }
      return true;
    });
  }, [alertas, selectedNombre, estadosSeleccionados, desde, hasta]);

  // Opciones del filtro: "Todas" + unidades operativas del contexto.
  const unidadOptions = useMemo(
    () => [UNIDAD_TODAS, ...UNIDADES_OPERATIVAS.map((u) => u.nombre)],
    [],
  );

  return (
    <div className="h-full overflow-y-auto p-6 text-text-primary">
      <h1 className="text-h2 font-bold text-primary-main mb-4 font-sans">
        Histórico de Alertas
      </h1>

      {/* ── Barra de filtros ───────────────────────────────────────────── */}
      <div className="mb-5 flex flex-wrap items-end gap-6">
        {/* Unidad Operativa */}
        <div className="flex flex-col gap-1.5">
          <label className="text-text-primary text-sm font-medium font-sans">Unidad Operativa</label>
          <select
            value={selectedNombre}
            onChange={(e) => setSelectedNombre(e.target.value)}
            className="px-3 py-2 rounded-lg outline outline-1 outline-offset-[-1px] outline-button-stroke bg-button-fill-button text-text-primary font-sans text-sm
                       focus:outline-2 focus:outline-primary-main"
          >
            {unidadOptions.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>

        {/* Estados (multi-select con checkboxes coloreados) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-text-primary text-sm font-medium font-sans">Estados</label>
          <div className="flex flex-wrap items-center gap-2 max-w-2xl">
            {ESTADOS_FILTRABLES.map((est) => {
              const isOn = estadosSeleccionados.has(est);
              return (
                <button
                  key={est}
                  type="button"
                  onClick={() =>
                    setEstadosSeleccionados((prev) => {
                      const next = new Set(prev);
                      if (next.has(est)) next.delete(est);
                      else next.add(est);
                      return next;
                    })
                  }
                  className={cn(
                    'inline-flex items-center gap-2 px-3 py-2 rounded-lg outline outline-1 outline-offset-[-1px] text-sm font-sans cursor-pointer transition-colors',
                    isOn
                      ? 'bg-primary-states-hover-main outline-primary-main text-primary-main font-bold'
                      : 'bg-background-main outline-button-stroke text-text-primary hover:bg-primary-states-hover-main/30',
                  )}
                >
                  <span className={`size-2.5 rounded-full ${ESTADO_DOT[est]}`} />
                  {ESTADO_LABEL[est]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Fecha desde */}
        <div className="flex flex-col gap-1.5">
          <label className="text-text-primary text-sm font-medium font-sans">Desde</label>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="px-3 py-2 rounded-lg outline outline-1 outline-offset-[-1px] outline-button-stroke bg-button-fill-button text-text-primary font-sans text-sm
                       focus:outline-2 focus:outline-primary-main"
          />
        </div>

        {/* Fecha hasta */}
        <div className="flex flex-col gap-1.5">
          <label className="text-text-primary text-sm font-medium font-sans">Hasta</label>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="px-3 py-2 rounded-lg outline outline-1 outline-offset-[-1px] outline-button-stroke bg-button-fill-button text-text-primary font-sans text-sm
                       focus:outline-2 focus:outline-primary-main"
          />
        </div>

        {/* Reset */}
        <button
          type="button"
          onClick={() => {
            setSelectedNombre(UNIDAD_TODAS);
            setEstadosSeleccionados(new Set(ESTADOS_FILTRABLES));
            setDesde('');
            setHasta('');
          }}
          className="px-4 py-2 rounded-lg outline outline-1 outline-offset-[-1px] outline-button-stroke text-text-primary text-sm font-medium font-sans
                     hover:bg-primary-states-hover-main/30 transition-colors"
        >
          Limpiar filtros
        </button>

        <span className="px-2 py-2 text-text-secondary text-xs font-sans">
          {isLoading ? 'Cargando...' : `${alertasFiltradas.length} resultado${alertasFiltradas.length === 1 ? '' : 's'}`}
        </span>
      </div>

      {/* ── Tabla histórica ───────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-text-secondary text-sm font-sans">Cargando alertas...</p>
        </div>
      ) : (
        <AlertsTable
          alertas={alertasFiltradas}
          selectedId={selectedId}
          onToggleSelect={handleToggleSelect}
          highlightSelected={false}
          sortSelectedFirst={false}
        />
      )}

      {/* Empty state si no hay resultados */}
      {!isLoading && alertasFiltradas.length === 0 && (
        <div className="mt-6 text-center text-text-secondary text-sm font-sans">
          No hay alertas que coincidan con los filtros seleccionados.
        </div>
      )}

      {preselectId && (
        <div className="mt-4 text-text-secondary text-xs font-sans">
          Alerta pre-seleccionada desde el mapa:{' '}
          <strong className="text-primary-main">{preselectId}</strong>
        </div>
      )}
    </div>
  );
}
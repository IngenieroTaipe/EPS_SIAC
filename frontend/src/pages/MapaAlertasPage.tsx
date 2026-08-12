import { useEffect, useMemo, useState } from 'react';
import { BaseMap } from '@/features/mapa/components/BaseMap';
import { LayerControl, type LayerId } from '@/features/mapa/components/LayerControl';
import { MapLegend } from '@/features/mapa/components/MapLegend';
import { PrecipitationLayer } from '@/features/mapa/components/PrecipitationLayer';
import { ComponentLayer } from '@/features/mapa/components/ComponentLayer';
import { ClusterAlertLayer } from '@/features/mapa/components/ClusterAlertLayer';
import { DistrictLayer } from '@/features/mapa/components/DistrictLayer';
import { AlertaDetailSheet } from '@/features/alertas/components/AlertaDetailSheet';
import { apiAlerts, type BackendAlertListItem } from '@/services/apiAlerts';
import { apiOrganization } from '@/services/apiOrganization';
import {
  mapAlertListToFrontend,
  resolveEstadoFromStatusAndPhase,
  buildBranchByUbigeo,
} from '@/features/alertas/alertAdapters';
import type { Alerta, EstadoAlerta } from '@/features/mapa/types/alerta';
import { ESTADOS_EN_MAPA } from '@/features/mapa/types/alerta';
import type { AlertaHistorica } from '@/features/alertas/types';

/**
 * Deriva un array de `Alerta` (para el ClusterAlertLayer del mapa) a
 * partir de los items del listado del backend.
 *
 * **1 marker por alerta**: si la alerta tiene varios `alert_clusters`
 * (varias zonas afectadas con su propio `representative_point`), se
 * calcula el centroide (promedio de LatLng) y se dibuja un único marker
 * allí. Antes se creaba un marker por `representative_point` con el mismo
 * `id` (= `item.code`), lo que hacía que el cluster contara N markers
 * pero al hacer clic siempre abriera la misma alerta ("veo 4, pero al
 * clic solo 1").
 *
 * El `estado` se deriva del primer `historic_alert` (bitácora desc by
 * `created_at` desde el backend) usando el adapter del dominio. Las
 * alertas en estado `no-confirmado` NO se dibujan en el mapa (solo
 * aparecen en el tabular).
 */
function deriveMapAlertas(items: BackendAlertListItem[]): Alerta[] {
  const alertas: Alerta[] = [];
  for (const item of items) {
    // Centroide de los representative_point no nulos.
    const points = item.alert_clusters
      .map((c) => c.representative_point?.coordinates)
      .filter((c): c is [number, number] => !!c);
    if (points.length === 0) continue;

    const sumLng = points.reduce((s, c) => s + c[0], 0);
    const sumLat = points.reduce((s, c) => s + c[1], 0);
    const lng = sumLng / points.length;
    const lat = sumLat / points.length;

    // Estado actual = primera entrada del historial (desc por created_at).
    const latest = item.historic_alert?.[0];
    const estadoHistorico = latest
      ? resolveEstadoFromStatusAndPhase(latest.status_name, latest.phase_name)
      : 'predicho';
    // `EstadoAlertaHistorica` y `EstadoAlerta` tienen el mismo catálogo
    // desde que añadi-mos `en-espera-reporte` al tipo del mapa, así que
    // el cast es seguro.
    const estado = estadoHistorico as EstadoAlerta;

    // Las alertas en `no-confirmado` solo viven en el tabular.
    if (!ESTADOS_EN_MAPA.has(estado)) continue;

    alertas.push({
      id: item.code,
      componenteId: '',
      estado,
      lat,
      lng,
      mensaje: `Intensidad: ${item.max_intensity_mm_h} mm/h`,
      nivel: item.max_threshold ?? item.natural_phenomena_name ?? 'Precipitación',
      fecha: item.start_time_local ?? new Date().toISOString(),
    });
  }
  return alertas;
}

/**
 * MapaAlertasPage — vista "Mapa de Alertas Climáticas".
 *
 * Renderiza el mapa Leaflet a pantalla completa con capas seleccionables
 * (precipitaciones, alertas, componentes desde LayerControl) + control de
 * capas flotante + leyenda auto-rotatoria.
 *
 * Detalle de la alerta seleccionada (alineado con `MapaComponentesPage`):
 *   - Al hacer clic en un marcador de alerta se abre el `AlertaDetailSheet`
 *     (drawer lateral derecho) con su información y un botón "Editar" →
 *     `/alertas/:id/editar`.
 *   - Clic en el mismo marcador cierra el sheet (toggle).
 *   - El estado `selectedAlertId` vive aquí y se propaga al
 *     `ClusterAlertLayer` para resaltar el marker (escala + halo
 *     amarillo, igual que `ComponentLayer` hace un anillo de selección).
 *
 * Antes existía un panel deslizable inferior con un tabular de alertas
 * (`MapAlertsPanel` / `AlertsTable`); quedó reemplazado por el sheet de
 * detalle (información más completa y menos ruido en el borde inferior).
 */
export function MapaAlertasPage() {
  // Capas por defecto activas: distritos y precipitaciones siempre on,
  // más la capa propia de la vista (alertas).
  const [selected, setSelected] = useState<Set<LayerId>>(() =>
    new Set(['distritos', 'precipitaciones', 'alertas']),
  );
  // ID de alerta seleccionada (single-selection). Null si ninguna.
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);

  // Datos del backend.
  const [backendItems, setBackendItems] = useState<BackendAlertListItem[]>([]);
  const [branchByUbigeo, setBranchByUbigeo] = useState<Map<string, string>>(
    () => new Map(),
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- secuencia de
       carga (loading true → fetch → loading false), patrón canónico. */
    setIsLoading(true);

    // Carga paralela de alertas + unidades operativas (branches). Las
    // branches sirven para resolver "Unidad Operativa" a partir de los
    // ubigeos afectados por cada alerta. Si fallan, las alertas cargan
    // igual pero el sheet mostrará UO vacía (no bloqueante).
    Promise.all([
      apiAlerts.listAlerts().catch((err) => {
        console.error('Error cargando alertas:', err);
        return [] as BackendAlertListItem[];
      }),
      apiOrganization.listBranches({ status: true }).catch((err) => {
        console.error('Error cargando unidades operativas:', err);
        return [];
      }),
    ])
      .then(([items, branches]) => {
        setBackendItems(items);
        setBranchByUbigeo(buildBranchByUbigeo(branches));
      })
      .finally(() => setIsLoading(false));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Derivar las alertas para el sheet (AlertaHistorica[]) y para el mapa (Alerta[]).
  const panelAlertas: AlertaHistorica[] = useMemo(
    () => backendItems.map((it) => mapAlertListToFrontend(it, branchByUbigeo)),
    [backendItems, branchByUbigeo],
  );
  const mapAlertas: Alerta[] = useMemo(
    () => (isLoading ? [] : deriveMapAlertas(backendItems)),
    [backendItems, isLoading],
  );

  // Resolver la alerta seleccionada (objeto) para pasarlo al sheet.
  const selectedAlerta = useMemo<AlertaHistorica | null>(() => {
    if (!selectedAlertId) return null;
    return panelAlertas.find((a) => a.id === selectedAlertId) ?? null;
  }, [panelAlertas, selectedAlertId]);

  function handleAlertaClick(id: string) {
    // Toggle: si está seleccionado y se clic de nuevo, se cierra el sheet.
    setSelectedAlertId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="relative h-full w-full pt-1 pr-1 pl-2 z-0">
      <div className="relative h-full w-full rounded-2xl border border-neutral-300 overflow-hidden">
        <BaseMap>
          {selected.has('distritos') && <DistrictLayer />}
          {selected.has('precipitaciones') && <PrecipitationLayer />}
          {selected.has('componentes')     && <ComponentLayer />}
          {selected.has('alertas') && (
            <ClusterAlertLayer
              alertas={mapAlertas}
              selectedAlertId={selectedAlertId}
              onAlertaClick={handleAlertaClick}
            />
          )}
        </BaseMap>

        <LayerControl
          selected={selected}
          onToggle={(id) =>
            setSelected((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
        />
        <MapLegend initialVariant="alertas" />

        {/* Sheet de detalle montado dentro del contenedor del mapa: ocupa
            exactamente su altura y deja al mapa interactivo (drag, zoom y
            clic en otros marcadores para cambiar la alerta en vivo). */}
        <AlertaDetailSheet
          alerta={selectedAlerta}
          onClose={() => setSelectedAlertId(null)}
        />
      </div>
    </div>
  );
}
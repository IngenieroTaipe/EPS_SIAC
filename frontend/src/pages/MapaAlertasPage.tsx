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
import { mapAlertListToFrontend } from '@/features/alertas/alertAdapters';
import type { Alerta, EstadoAlerta } from '@/features/mapa/types/alerta';
import type { AlertaHistorica } from '@/features/alertas/types';

/**
 * Deriva un array de `Alerta` (para el ClusterAlertLayer del mapa) a
 * partir de los items del listado del backend. Cada cluster dentro de
 * una alerta genera un marcador en el mapa (con su representative_point).
 */
function deriveMapAlertas(items: BackendAlertListItem[]): Alerta[] {
  const alertas: Alerta[] = [];
  for (const item of items) {
    for (const cluster of item.alert_clusters) {
      if (!cluster.representative_point) continue;
      const [lng, lat] = cluster.representative_point.coordinates;
      alertas.push({
        id: item.code,
        componenteId: '',
        estado: 'predicho' as EstadoAlerta,
        lat,
        lng,
        mensaje: `Intensidad: ${item.max_intensity_mm_h} mm/h`,
        nivel: item.max_threshold ?? 'Precipitación',
        fecha: item.start_time_local ?? new Date().toISOString(),
      });
    }
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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- secuencia de
       carga (loading true → fetch → loading false), patrón canónico. */
    setIsLoading(true);
    apiAlerts.listAlerts()
      .then(setBackendItems)
      .catch((err) => console.error('Error cargando alertas:', err))
      .finally(() => setIsLoading(false));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Derivar las alertas para el sheet (AlertaHistorica[]) y para el mapa (Alerta[]).
  const panelAlertas: AlertaHistorica[] = useMemo(
    () => backendItems.map(mapAlertListToFrontend),
    [backendItems],
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
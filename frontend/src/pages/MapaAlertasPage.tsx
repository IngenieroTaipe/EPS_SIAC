import { useEffect, useState } from 'react';
import { BaseMap } from '@/features/mapa/components/BaseMap';
import { LayerControl, type LayerId } from '@/features/mapa/components/LayerControl';
import { MapLegend } from '@/features/mapa/components/MapLegend';
import { PrecipitationLayer } from '@/features/mapa/components/PrecipitationLayer';
import { ComponentLayer } from '@/features/mapa/components/ComponentLayer';
import { ClusterAlertLayer } from '@/features/mapa/components/ClusterAlertLayer';
import { DistrictLayer } from '@/features/mapa/components/DistrictLayer';
import { MapAlertsPanel } from '@/features/alertas/components/MapAlertsPanel';
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
 * capas flotante + leyenda auto-rotatoria + panel deslizable abajo con la
 * tabla de alertas.
 *
 * La alerta seleccionada en el panel (o en el mapa) se resalta en ambos
 * lugares con fondo amarillo (tabla) o icono más grande/contraste (mapa).
 */
export function MapaAlertasPage() {
  // Capa por defecto activa.
  const [selected, setSelected] = useState<Set<LayerId>>(() => new Set(['alertas']));
  // ID de alerta seleccionada (single-selection). Null si ninguna.
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);

  // Datos del backend
  const [backendItems, setBackendItems] = useState<BackendAlertListItem[]>([]);

  useEffect(() => {
    apiAlerts.listAlerts()
      .then(setBackendItems)
      .catch((err) => console.error('Error cargando alertas:', err));
  }, []);

  // Derivar las alertas para el panel (AlertaHistorica[]) y para el mapa (Alerta[])
  const panelAlertas: AlertaHistorica[] = backendItems.map(mapAlertListToFrontend);
  const mapAlertas: Alerta[] = deriveMapAlertas(backendItems);

  function handleToggleSelect(id: string) {
    setSelectedAlertId((prev) => (prev === id ? null : id));
  }

  return (
  <div className="relative h-full w-full pt-1 pr-1 pl-2 z-0">
    <div className="relative h-full w-full rounded-2xl border border-neutral-300 overflow-hidden">
      <BaseMap>
        <DistrictLayer />
        {selected.has('precipitaciones') && <PrecipitationLayer />}
        {selected.has('componentes')     && <ComponentLayer />}
        {selected.has('alertas') && (
          <ClusterAlertLayer
            alertas={mapAlertas}
            selectedAlertId={selectedAlertId}
            onAlertaClick={handleToggleSelect}
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

      <MapAlertsPanel
        alertas={panelAlertas}
        selectedId={selectedAlertId}
        onToggleSelect={handleToggleSelect}
      />
    </div>
  </div>
  );
}
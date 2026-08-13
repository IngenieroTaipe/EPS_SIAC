import { useEffect, useState } from 'react';
import { BaseMap } from '@/features/mapa/components/BaseMap';
import {
  LayerControl,
  type LayerControlOption,
  type LayerId,
} from '@/features/mapa/components/LayerControl';
import { MapLegend } from '@/features/mapa/components/MapLegend';
import { PrecipitationLayer } from '@/features/mapa/components/PrecipitationLayer';
import { ClusterAlertLayer } from '@/features/mapa/components/ClusterAlertLayer';
import { DistrictLayer } from '@/features/mapa/components/DistrictLayer';
import { apiAlerts, type BackendAlertListItem } from '@/services/apiAlerts';
import type { Alerta } from '@/features/mapa/types/alerta';
import { deriveMapAlertas } from '@/features/mapa/utils/deriveMapAlertas';

/**
 * HomePage — pestaña principal pública (antes de iniciar sesión).
 *
 * Muestra la misma vista geoespacial que el "Mapa de Alertas Climáticas"
 * (mapa Leaflet + control de capas + leyenda) pero SIN el panel tabular
 * inferior. Solo la vista de capas y la leyenda, tal como se ve cuando
 * uno entra sin autenticarse.
 *
 * La capa "Componentes" NO está disponible para el usuario no autenticado
 * (información sensible que solo corresponde ver tras iniciar sesión).
 * Tampoco se renderiza en el mapa aunque el estado lo intente activar.
 *
 * El layout lo provee `GuestLayout` (TopBar con botón "Iniciar Sesión").
 */
const HOME_LAYER_OPTIONS: LayerControlOption[] = [
  { id: 'distritos', label: 'Límites de Distritos' },
  { id: 'precipitaciones', label: 'Mapa de Precipitaciones' },
  { id: 'alertas', label: 'Mapa de Alertas' },
  // 'componentes' omitido intencionalmente — requiere autenticación.
];

export function HomePage() {
  // Capas por defecto activas: distritos, precipitaciones y alertas.
  const [selected, setSelected] = useState<Set<LayerId>>(
    () => new Set(['distritos', 'precipitaciones', 'alertas']),
  );
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);

  // Datos del backend.
  const [backendItems, setBackendItems] = useState<BackendAlertListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    /* eslint-disable react-hooks/react-hooks-set-state-in-effect -- secuencia de
       carga (loading true → fetch → loading false), patrón canónico. */
    setIsLoading(true);
    apiAlerts
      .listAlerts()
      .then((items) => setBackendItems(items))
      .catch((err) => {
        console.error('Error cargando alertas:', err);
        setBackendItems([]);
      })
      .finally(() => setIsLoading(false));
    /* eslint-enable react-hooks/react-hooks-set-state-in-effect */
  }, []);

  const mapAlertas: Alerta[] = isLoading ? [] : deriveMapAlertas(backendItems);

  function handleToggleSelect(id: string) {
    setSelectedAlertId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="relative h-full w-full z-0">
      <div className="relative h-full w-full">
        <BaseMap>
          {selected.has('distritos') && <DistrictLayer />}
          {selected.has('precipitaciones') && <PrecipitationLayer />}
          {selected.has('alertas') && (
            <ClusterAlertLayer
              alertas={mapAlertas}
              selectedAlertId={selectedAlertId}
              onAlertaClick={handleToggleSelect}
            />
          )}
        </BaseMap>

        <LayerControl
          options={HOME_LAYER_OPTIONS}
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
        <MapLegend initialVariant="alertas" variants={['alertas', 'precipitaciones']} />
      </div>
    </div>
  );
}
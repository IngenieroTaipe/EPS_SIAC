import { MapPage } from '@/features/mapa/components/MapPage';

/**
 * MapaAlertasPage — vista "Mapa de Alertas Climáticas".
 *
 * Renderiza el mapa leaflet a pantalla completa (debajo del TopBar) con
 * la capa de alertas activa por defecto. El usuario puede activar más
 * capas desde el control flotante (LayerControl).
 */
export function MapaAlertasPage() {
  return <MapPage defaultLayers={['alertas']} />;
}
import { MapPage } from '@/features/mapa/components/MapPage';

/**
 * MapaClimaticoPage — vista "Monitoreo de Precipitaciones".
 * Capa por defecto: 'precipitaciones'. El usuario puede activar más
 * capas desde el control de capas flotante.
 */
export function MapaClimaticoPage() {
  return <MapPage defaultLayers={['precipitaciones']} />;
}
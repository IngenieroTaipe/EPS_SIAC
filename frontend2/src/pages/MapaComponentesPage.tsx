import { MapPage } from '@/features/mapa/components/MapPage';

/**
 * MapaComponentesPage — vista "Mapa de Componentes".
 * Capa por defecto: 'componentes'. El usuario puede activar más desde
 * el control de capas flotante.
 */
export function MapaComponentesPage() {
  return <MapPage defaultLayers={['componentes']} />;
}
import { httpClient } from './httpClient';
import { cachedGet } from './requestCache';
import type { GfsClusterFeatureCollection } from '@/features/mapa/types/gfs';

/**
 * Cliente del endpoint de clústeres espacio-temporales GFS.
 *
 * Endpoint:
 *   - /gfs-clusters-snapshots/historic-window/  (~300 clústeres disueltos, 500 KB)
 */
export const apiGFS = {
  /** Trae la ventana 18h (T-6h .. T+12h) de la última corrida GFS. */
  async getHistoricWindowClusters(): Promise<GfsClusterFeatureCollection> {
    // Caché en localStorage: la ventana 18h sólo cambia por corrida GFS
    // (cada 6h aprox.). TTL de 10 min para respetar el "Última
    // actualización" del TopBar, pero sin re-refetchear en cada navegación.
    // Sobrevive a recargas del navegador.
    return cachedGet(
      'gfs:historic-window',
      async () => {
        const res = await httpClient.get(
          '/core_predictive/gfs-clusters-snapshots/historic-window/',
        );
        return res.data as GfsClusterFeatureCollection;
      },
      10 * 60_000,
    );
  },
};
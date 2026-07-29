import { httpClient } from './httpClient';
import type {
  GfsCellFeatureCollection,
  GfsClusterFeatureCollection,
} from '@/features/mapa/types/gfs';

/**
 * Cliente del endpoint de clústeres espacio-temporales GFS.
 *
 * Endpoints:
 *   - /gfs-clusters-snapshots/window-18h/  (~300 clústeres disueltos, 500 KB)
 *   - /gfs-active-cells/latest/             (~12 000 celdas, 7 MB)  [v2]
 */
export const apiGFS = {
  /** Trae la ventana 18h (T-6h .. T+12h) de la última corrida GFS. */
  async getWindow18h(): Promise<GfsClusterFeatureCollection> {
    const res = await httpClient.get(
      '/core_predictive/gfs-clusters-snapshots/window-18h/',
    );
    return res.data as GfsClusterFeatureCollection;
  },

  /**
   * Trae las celdas individuales de la última corrida GFS (~12 000).
   * Endpoint pesado (~7 MB): usar sólo para comparación visual con clusters.
   */
  async getLatestCells(): Promise<GfsCellFeatureCollection> {
    const res = await httpClient.get(
      '/core_predictive/gfs-active-cells/latest/',
    );
    return res.data as GfsCellFeatureCollection;
  },
};
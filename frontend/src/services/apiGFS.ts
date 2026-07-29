import { httpClient } from './httpClient';
import type { GfsFeatureCollection } from '@/features/mapa/types/gfs';

/**
 * Cliente del endpoint de celdas GFS activas (pronóstico ~10km).
 *
 *   GET /api/v1/core_predictive/gfs-active-cells/latest/
 *
 * Devuelve un GeoJSON FeatureCollection con series temporales de 12 horas
 * por celda (ver `GfsFeatureCollection`).
 */
export const apiGFS = {
  async getLatest(): Promise<GfsFeatureCollection> {
    const res = await httpClient.get('/core_predictive/gfs-active-cells/latest/');
    return res.data as GfsFeatureCollection;
  },
};
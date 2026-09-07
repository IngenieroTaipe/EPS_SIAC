import { useContext } from 'react';
import { MapLayersContext, type MapLayersContextValue } from './MapLayersContext';

/** Hook de consumo del `MapLayersContext` (ver `MapLayersProvider`). */
export function useMapLayers(): MapLayersContextValue {
  const ctx = useContext(MapLayersContext);
  if (!ctx) {
    throw new Error('useMapLayers debe usarse dentro de MapLayersProvider');
  }
  return ctx;
}

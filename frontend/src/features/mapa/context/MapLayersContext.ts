import { createContext } from 'react';
import type { LayerId } from '@/features/mapa/components/LayerControl';

/**
 * MapLayersContext — contexto compartido de capas activas y variante de
 * leyenda entre el `MapLayout` (que monta el `<BaseMap>` persistente) y las
 * páginas de mapa (`MapaAlertasPage`, `MapaComponentesPage`).
 *
 * Motivo: al elevar el `<BaseMap>` al layout para que no se re-monte al
 * navegar entre rutas, el `LayerControl` y el `MapLegend` (overlays
 * shared) necesitan saber qué capas están activas y qué variante de
 * leyenda corresponde a la ruta actual. Las páginas setean sus defaults
 * al montar vía `setActiveLayers` / `setLegendVariant`.
 *
 * Estructura de archivos (patrón de UnidadOperativaContext):
 *   - `MapLayersContext.ts`   — este archivo: contexto + tipos.
 *   - `MapLayersProvider.tsx` — el Provider (sólo componentes).
 *   - `useMapLayers.ts`       — el hook de consumo.
 */

export type LegendVariant = 'alertas' | 'precipitaciones' | 'componentes';

export interface MapLayersContextValue {
  /** Capas activamente seleccionadas (controla qué capas se renderizan). */
  activeLayers: Set<LayerId>;
  /** Reemplaza el set completo de capas activas (lo usan las páginas al montar). */
  setActiveLayers: (layers: Set<LayerId>) => void;
  /** Alterna una capa individual (lo usa el LayerControl). */
  toggleLayer: (id: LayerId) => void;
  /** Variante de leyenda activa (depende de la ruta). */
  legendVariant: LegendVariant;
  /** Setter de la variante de leyenda (lo usan las páginas al montar). */
  setLegendVariant: (v: LegendVariant) => void;
}

export const MapLayersContext = createContext<MapLayersContextValue | null>(null);

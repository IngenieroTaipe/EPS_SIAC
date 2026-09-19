import { createContext, type ReactNode } from 'react';
import type { LayerId } from '@/features/mapa/components/LayerControl';

/**
 * MapLayersContext — estado compartido de capas activas, variante de
 * leyenda y OVERLAYS registrados entre el `MapLayout` (que monta el
 * `<BaseMap>` en modo keep-alive, SIEMPRE montado y oculto fuera de las
 * rutas de mapa) y las páginas de mapa (`MapaAlertasPage`,
 * `MapaComponentesPage`).
 *
 * Motivo del keep-alive: al desmontar el mapa al navegar a rutas sin mapa
 * y volver, Leaflet re-dibujaba ~300 polígonos de precipitaciones (~1s de
 * parpadeo). Con el mapa siempre montado (oculto con `visibility`), al
 * volver está exactamente como se dejó.
 *
 * Overlays: como el mapa ya NO envuelve a las páginas (no hay `<Outlet />`
 * dentro del `<BaseMap>`), las páginas de mapa REGISTRAN sus capas y
 * sheets como nodos React en este contexto; el `MapLayout` los renderiza
 * dentro del `<BaseMap>`. Las páginas re-registran cuando cambian sus
 * props (datos/selección) y se des-registran al desmontarse.
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
  /** Registra (o actualiza) el overlay de una página de mapa: capas y
   *  sheets que deben renderizarse DENTRO del `<BaseMap>`. Re-registrar
   *  con el mismo `key` actualiza el nodo (reconciliación por key → las
   *  capas NO se remontan, sólo re-renderizan con las props nuevas). */
  registerOverlay: (key: string, node: ReactNode) => void;
  /** Des-registra el overlay de una página (al desmontarse). */
  unregisterOverlay: (key: string) => void;
  /** Overlays registrados (key → nodo). Lo renderiza el `MapLayout`. */
  overlays: Map<string, ReactNode>;
}

export const MapLayersContext = createContext<MapLayersContextValue | null>(null);

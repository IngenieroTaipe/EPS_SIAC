/**
 * Tipos mínimos para `leaflet.heat` (sin tipos oficiales).
 * Extiende el namespace `L` de leaflet declarando `heatLayer`.
 */
declare module 'leaflet' {
  interface HeatLayer extends Layer {
    setOptions(options: L.HeatLayerOptions): this;
  }

  interface HeatLayerOptions {
    minOpacity?: number;
    maxZoom?: number;
    max?: number;
    radius?: number;
    blur?: number;
    gradient?: Record<number, string>;
  }

  // Agregado al final para mantener compat con el export original.
  function heatLayer(
    latlngs: Array<[number, number, number?]>,
    options?: HeatLayerOptions,
  ): HeatLayer;
}

declare module 'leaflet.heat';
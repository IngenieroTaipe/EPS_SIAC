import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GeoJSON as GeoJSONComponent, useMap } from 'react-leaflet';
import { apiGFS } from '@/services/apiGFS';
import { usePrecipitationTimeline } from '@/features/mapa/timeline/usePrecipitationTimeline';
import {
  GFS_COLOR_MAP,
  GFS_LABEL,
  extractHHmm,
  getThreshold,
  intensityAt,
  type GfsCategory,
  type GfsCellFeature,
  type GfsCellFeatureCollection,
} from '@/features/mapa/types/gfs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GeoJSONAny = GeoJSONComponent as any;

/**
 * PrecipitationLayerCells — V2 TEMPORAL para comparación visual con clusters.
 *
 * Consume `/gfs-active-cells/latest/` (~12 000 celdas individuales GFS, ~7 MB)
 * y recolorea por índice del timeline (vía `frameIndex` del contexto) usando
 * `intensity_series[hourIndex]` sobre la capa `L.GeoJSON` existente.
 *
 * Estado de la timeline vive en `PrecipitationTimelineProvider`; aquí solo
 * leemos `frameIndex`/`setFrameIndex` y mapeamos al rango propio de celdas
 * (clampado a `hours.length-1` si escalas difieren).
 *
 * === BORRAR al cerrar la comparación con `PrecipitationLayer` (clusters) ===
 */
export function PrecipitationLayerCells() {
  const [data, setData] = useState<GfsCellFeatureCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = useMap() as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geoJsonRef = useRef<any>(null);

  // frameIndex del contexto compartido; clampado a la escala de las celdas.
  const { frameIndex } = usePrecipitationTimeline();

  useEffect(() => {
    if (map) map.options.preferCanvas = true;
  }, [map]);

  // Fetch del pesado endpoint de celdas (una sola vez al montar).
  useEffect(() => {
    let cancelled = false;
    apiGFS
      .getLatestCells()
      .then((geojson: GfsCellFeatureCollection) => {
        if (cancelled) return;
        // Las celdas individuales forman una grilla continua (~12 000 celdas).
        // NO se suavizan celda por celda para evitar abrir grietas entre celdas
        // contiguas del mismo umbral. Mantenemos `geometry` intacta.
        const smoothedFeatures = geojson.features.map((f: GfsCellFeature) => ({
          ...f,
          properties: {
            ...f.properties,
            _smoothedGeometry: f.geometry,
          },
        }));
        setData({ ...geojson, features: smoothedFeatures });
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Etiquetas "HH:mm" extraídas del primer feature con `timestamps` válido. */
  const hoursCount = (() => {
    const feats = (data as GfsCellFeatureCollection | null)?.features ?? [];
    for (const f of feats) {
      const ts = f.properties?.timestamps;
      if (Array.isArray(ts) && ts.length > 0) return ts.length;
    }
    return 0;
  })();
  const hourIndex = hoursCount > 0 ? Math.min(frameIndex, hoursCount - 1) : 0;

  // Recolorea todas las celdas al mover el timeline (sin reconstruir la capa).
  useEffect(() => {
    const layer = geoJsonRef.current;
    if (!layer) return;
    layer.setStyle((feature: GfsCellFeature) => styleFor(feature, hourIndex));
  }, [hourIndex, data]);

  // Re-bindea los tooltips por hora activa: muestra el umbral + intensidad
  // del frame seleccionado (no el máximo de las 12h como antes).
  useEffect(() => {
    const layer = geoJsonRef.current;
    if (!layer) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    layer.eachLayer((l: any) => {
      const f = l.feature as GfsCellFeature | undefined;
      if (!f) {
        l.unbindTooltip?.();
        return;
      }
      l.unbindTooltip?.();
      const mmh = intensityAt(f, hourIndex);
      const cat = getThreshold(mmh);
      if (cat === '-') return;
      const ts = f.properties?.timestamps?.[hourIndex];
      const hhmm = extractHHmm(ts);
      l.bindTooltip(
        `<div style="font-family: var(--eps-font-family-sans); color: var(--eps-text-primary);">
           <strong style="color: var(--eps-primary-main);">${GFS_LABEL[cat]}</strong><br/>
           <span style="font-size: 12px;">${hhmm} · ${mmh.toFixed(2)} mm/h</span>
         </div>`,
        { sticky: true, direction: 'top', offset: [0, -5] },
      );
    });
  }, [hourIndex, data]);

  function styleFor(feature: GfsCellFeature, idx: number) {
    const mmh = intensityAt(feature, idx);
    const cat: GfsCategory = getThreshold(mmh);
    if (cat === '-') return { fillOpacity: 0, stroke: false };
    return {
      fillColor: GFS_COLOR_MAP[cat],
      fillOpacity: 0.6,
      stroke: false,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onEachFeature(_feature: GfsCellFeature, _layer: any) {
    // Sin bindeo inicial: el useEffect de arriba re-bindea por hora activa.
  }

  // === SEPARACIÓN DE GEOMETRÍAS (pintar vs negocio) ========================
  const renderData: GfsCellFeatureCollection | null = (() => {
    if (!data) return null;
    return {
      type: 'FeatureCollection',
      metadata: data.metadata,
      features: data.features.map((f) => ({
        ...f,
        geometry: f.properties._smoothedGeometry ?? f.geometry,
      })),
    };
  })();

  if (loading || !renderData) {
    const portalTarget = map?.getContainer?.()?.parentElement ?? null;
    return portalTarget
      ? createPortal(
          <div
            style={{
              position: 'absolute',
              bottom: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
              padding: '8px 16px',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.95)',
              color: '#170f49',
              fontFamily: 'var(--eps-font-family-sans)',
              fontSize: 13,
              boxShadow: '0 5px 5px rgba(0,0,0,0.25)',
            }}
          >
            {error ? `Error celdas: ${error.message}` : 'Cargando celdas (~7 MB)…'}
          </div>,
          portalTarget,
        )
      : null;
  }

  return (
    <>
      <GeoJSONAny
        key={`cells-${renderData.metadata?.request_code ?? ''}`}
        data={renderData}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ref={(layer: any) => {
          geoJsonRef.current = layer;
        }}
        style={(feature: GfsCellFeature) => styleFor(feature, hourIndex)}
        onEachFeature={onEachFeature}
      />
    </>
  );
}
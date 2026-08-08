import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GeoJSON as GeoJSONComponent, useMap } from 'react-leaflet';
import { apiGFS } from '@/services/apiGFS';
import { usePrecipitationTimeline } from '@/features/mapa/timeline/usePrecipitationTimeline';
import {
  GFS_COLOR_MAP,
  GFS_LABEL,
  classifyCell,
  extractHHmm,
  intensityAt,
  type GfsCategory,
  type GfsCellFeature,
  type GfsCellFeatureCollection,
} from '@/features/mapa/types/gfs';
import type { GfsFrame } from '@/features/mapa/timeline/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GeoJSONAny = GeoJSONComponent as any;

/** Opacidad de relleno para celdas con lluvia. */
const FILL_OPACITY = 0.6;

/**
 * PrecipitationLayerCells — V2 TEMPORAL para comparación visual con clusters.
 *
 * Consume `/gfs-active-cells/window-18h/` que integra:
 *   - Celdas de la corrida previa  (temporal_status='HISTORIC', ~12 000)
 *   - Celdas de la corrida actual   (temporal_status='FORECAST',  ~12 000)
 *
 * Cada celda trae `threshold_names` (12 valores, clasificación por distrito
 * hecha en el backend) y `temporal_status`. El timeline selecciona el frame
 * activo (temporal_status + time_step); las celdas de la otra mitad quedan
 * invisibles (opacity 0) pero siguen en el DOM para evitar re-mounts.
 *
 * Comportamiento por frame:
 *   HISTORIC step 1..6 → hourIndex 0..5 en celdas HISTORIC
 *   FORECAST step 1..12 → hourIndex 0..11 en celdas FORECAST
 */
export function PrecipitationLayerCells() {
  const [data, setData] = useState<GfsCellFeatureCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = useMap() as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geoJsonRef = useRef<any>(null);

  const { activeFrame } = usePrecipitationTimeline();

  useEffect(() => {
    if (map) map.options.preferCanvas = true;
  }, [map]);

  // Fetch del endpoint window-18h de celdas (una sola vez al montar).
  useEffect(() => {
    let cancelled = false;
    apiGFS
      .getWindow18hCells()
      .then((geojson: GfsCellFeatureCollection) => {
        if (cancelled) return;
        // Las celdas individuales forman una grilla continua. NO se suavizan
        // celda por celda para evitar abrir grietas entre celdas contiguas.
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

  // Longitud de la serie temporal (debería ser 12 en ambas corridas).
  const hoursCount = (() => {
    const feats = data?.features ?? [];
    for (const f of feats) {
      const ts = f.properties?.timestamps;
      if (Array.isArray(ts) && ts.length > 0) return ts.length;
    }
    return 0;
  })();

  // Mapear el frame activo al índice de intensity_series.
  //   HISTORIC → time_step - 1 (1-indexed → 0-indexed, rango 0..5)
  //   FORECAST → time_step - 1 (rango 0..11)
  // Sin activeFrame → -1 (no se dibuja nada).
  const hourIndex = activeFrame
    ? Math.max(0, Math.min(activeFrame.time_step - 1, Math.max(0, hoursCount - 1)))
    : -1;

  // Recolorea + gestiona interactividad al mover el timeline.
  useEffect(() => {
    const layer = geoJsonRef.current;
    if (!layer) return;
    layer.setStyle((feature: GfsCellFeature) =>
      styleFor(feature, hourIndex, activeFrame),
    );
    // Alternar interactividad: solo las celdas del frame activo capturan hover.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    layer.eachLayer((l: any) => {
      const f = l.feature as GfsCellFeature | undefined;
      if (!f) {
        l.options.interactive = false;
        return;
      }
      const featureStatus = f.properties?.temporal_status ?? 'FORECAST';
      const activeStatus = activeFrame?.temporal_status ?? 'FORECAST';
      const interactive =
        featureStatus === activeStatus &&
        hourIndex >= 0 &&
        classifyCell(f, hourIndex) !== '-';
      l.options.interactive = interactive;
    });
  }, [hourIndex, data, activeFrame]);

  // Re-bindea los tooltips por hora activa.
  useEffect(() => {
    const layer = geoJsonRef.current;
    if (!layer || !activeFrame) return;
    const activeStatus = activeFrame.temporal_status;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    layer.eachLayer((l: any) => {
      const f = l.feature as GfsCellFeature | undefined;
      l.unbindTooltip?.();
      if (!f) return;
      const featureStatus = f.properties?.temporal_status ?? 'FORECAST';
      if (featureStatus !== activeStatus) return;
      if (hourIndex < 0) return;
      const mmh = intensityAt(f, hourIndex);
      const cat = classifyCell(f, hourIndex);
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
  }, [hourIndex, data, activeFrame]);

  function styleFor(
    feature: GfsCellFeature,
    idx: number,
    active: GfsFrame | undefined,
  ) {
    if (!active) return { fillOpacity: 0, stroke: false };
    const featureStatus = feature.properties?.temporal_status ?? 'FORECAST';
    if (featureStatus !== active.temporal_status)
      return { fillOpacity: 0, stroke: false };
    const cat: GfsCategory = classifyCell(feature, idx);
    if (cat === '-') return { fillOpacity: 0, stroke: false };
    return {
      fillColor: GFS_COLOR_MAP[cat],
      fillOpacity: FILL_OPACITY,
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
            {error ? `Error celdas: ${error.message}` : 'Cargando celdas 18h (~14 MB)…'}
          </div>,
          portalTarget,
        )
      : null;
  }

  return (
    <>
      <GeoJSONAny
        key={`cells-${renderData.metadata?.latest_request_code ?? ''}-${renderData.metadata?.previous_request_code ?? ''}`}
        data={renderData}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ref={(layer: any) => {
          geoJsonRef.current = layer;
        }}
        style={(feature: GfsCellFeature) => styleFor(feature, hourIndex, activeFrame)}
        onEachFeature={onEachFeature}
      />
    </>
  );
}
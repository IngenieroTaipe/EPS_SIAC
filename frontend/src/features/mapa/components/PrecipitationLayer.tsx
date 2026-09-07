import { useEffect, useRef } from 'react';
import { GeoJSON as GeoJSONComponent, useMap } from 'react-leaflet';
import { usePrecipitationTimeline } from '@/features/mapa/timeline/usePrecipitationTimeline';
import {
  GFS_COLOR_MAP,
  GFS_LABEL,
  classifyCluster,
  type GfsCategory,
  type GfsClusterFeature,
} from '@/features/mapa/types/gfs';
import type { GfsFrame } from '@/features/mapa/timeline/types';

// react-leaflet@5 + @types/leaflet@1.9 bajo moduleResolution: bundler no
// resuelve bien los tipos del componente GeoJSON; cast a `any` como en BaseMap.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GeoJSONAny = GeoJSONComponent as any;

/** Opacidad de relleno para clusters con lluvia (idéntica para todas). */
const FILL_OPACITY_VISIBLE = 0.6;

/**
 * PrecipitationLayer — capa de clústeres GFS (18h) dibujada sobre el mapa.
 *
 * Estado de la línea de tiempo (frames, frameIndex) vive en
 * `PrecipitationTimelineProvider` (montado en AppLayout), así que este
 * componente sólo:
 *   - Lee `renderData` + `frameIndex`/`activeFrame` del contexto.
 *   - Recolorea el `L.GeoJSON` según el frame activo (sin reconstruir la capa).
 *
 * Ya NO portalear la timeline: el footer vive en AppLayout hermanado con
 * el contenido de la ruta.
 */
export function PrecipitationLayer() {
  const {
    renderData,
    loading,
    frames,
    frameIndex,
    activeFrame,
  } = usePrecipitationTimeline();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = useMap() as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geoJsonRef = useRef<any>(null);

  const lastMouseEvent = useRef<{ clientX: number; clientY: number } | null>(null);

  // Forzar Canvas renderer para máxima performance con cientos de polígonos.
  useEffect(() => {
    if (!map) return;
    map.options.preferCanvas = true;
  }, [map]);


  useEffect(() => {
  if (!map) return;
  const container = map.getContainer();
  const handleMove = (e: MouseEvent) => {
    lastMouseEvent.current = { clientX: e.clientX, clientY: e.clientY };
  };
  container.addEventListener('mousemove', handleMove);
  return () => container.removeEventListener('mousemove', handleMove);
}, [map]);

  /**
   * Re-estiliza TODAS las features al mover el slider/timeline.
   * Regla de visibilidad (igual que antes).
   */
  useEffect(() => {
    const layer = geoJsonRef.current;
    if (!layer || !activeFrame) return;
    layer.setStyle((feature: GfsClusterFeature) => styleForFrame(feature, activeFrame)); 
    // Alternar interactividad: solo la feature del frame activo captura el
    // hover; las otras 17 apiladas se duermen. setStyle NO re-bindea eventos,
    // hace falta setInteractive/setNonInteractive.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    layer.eachLayer((l: any) => {
      const p = (l.feature as GfsClusterFeature | undefined)?.properties;
      if (!p) {
        l.options.interactive = false;
        return;
      }
      const sameFrame =
        p.time_step === activeFrame.time_step &&
        (p.temporal_status ?? 'FORECAST') === activeFrame.temporal_status;
      const cat = classifyCluster(p);
      const interactive = sameFrame && cat !== '-';
      l.options.interactive = interactive;
    });
    if (lastMouseEvent.current && map) {
    const container = map.getContainer();
    const evt = new MouseEvent('mousemove', {
      clientX: lastMouseEvent.current.clientX,
      clientY: lastMouseEvent.current.clientY,
      bubbles: true,
    });
    container.dispatchEvent(evt);
    } 
  }, [frameIndex, frames, activeFrame, renderData]);

  /** Calcula PathOptions según si la feature pertenece al frame activo. */
  function styleForFrame(
    feature: GfsClusterFeature,
    active: GfsFrame | undefined,
  ) {
    const p = feature?.properties ?? null;
    if (!p || !active) return { fillOpacity: 0, stroke: false };
    const sameFrame =
      p.time_step === active.time_step &&
      (p.temporal_status ?? 'FORECAST') === active.temporal_status;
    if (!sameFrame) return { fillOpacity: 0, stroke: false };
    const cat: GfsCategory = classifyCluster(p);
    if (cat === '-') return { fillOpacity: 0, stroke: false };
    return {
      fillColor: GFS_COLOR_MAP[cat],
      fillOpacity: FILL_OPACITY_VISIBLE,
      stroke: false,
    };
  }

  /**
   * Re-bindea los tooltips según el frame activo. Sólo la feature del frame
   * seleccionado recibe un tooltip (con su intensidad/umbral de ESA hora);
   * las demás (mismos polígono apilado para otras 17 horas) lo liberan. Así
   * el popup refleja la hora del timeline, no el "peor step" apilado arriba.
   */
  useEffect(() => {
    const layer = geoJsonRef.current;
    if (!layer || !activeFrame) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    layer.eachLayer((l: any) => {
      const p = (l.feature as GfsClusterFeature | undefined)?.properties;
      l.unbindTooltip?.();
      if (!p) return;
      const sameFrame =
        p.time_step === activeFrame.time_step &&
        (p.temporal_status ?? 'FORECAST') === activeFrame.temporal_status;
      if (!sameFrame) return;
      const cat = classifyCluster(p);
      if (cat === '-') return;
      const mmh = p.max_intensity_mm_h ?? 0;
      l.bindTooltip(
        `<div style="font-family: var(--eps-font-family-sans); color: var(--eps-text-primary);">
           <strong style="color: var(--eps-primary-main);">${GFS_LABEL[cat]}</strong><br/>
           <span style="font-size: 12px;">${activeFrame.label} · ${mmh.toFixed(2)} mm/h</span>
         </div>`,
        { sticky: true, direction: 'top', offset: [0, -5] },
      );
    });
  }, [frameIndex, frames, activeFrame, renderData]);

  if (loading || !renderData) return null;

  return (
    <GeoJSONAny
      // El `key` cambia por cada par de corridas (latest+previous) para
      // forzar el remount del GeoJSON y evitar features obsoletos.
      key={`gfs-${renderData.metadata?.latest_request_code ?? ''}-${renderData.metadata?.previous_request_code ?? ''}`}
      data={renderData}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={(layer: any) => {
        geoJsonRef.current = layer;
      }}
      style={(feature: GfsClusterFeature) =>
        styleForFrame(feature, activeFrame)
      }
    />
  );
}
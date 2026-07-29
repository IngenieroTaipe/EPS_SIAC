import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GeoJSON as GeoJSONComponent, useMap } from 'react-leaflet';
import { PrecipitationLayerCells } from './PrecipitationLayerCells';
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
 *   - En modo 'cells' delega a `PrecipitationLayerCells` (TEMPORAL).
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
  // === TEMPORAL: toggle de comparación visual Clusters vs Celdas (~12k) ===
  const [viewMode, setViewMode] = useState<'clusters' | 'cells'>('clusters');

  // Forzar Canvas renderer para máxima performance con cientos de polígonos.
  useEffect(() => {
    if (!map) return;
    map.options.preferCanvas = true;
  }, [map]);

  /**
   * Re-estiliza TODAS las features al mover el slider/timeline.
   * Regla de visibilidad (igual que antes).
   */
  useEffect(() => {
    const layer = geoJsonRef.current;
    if (!layer) return;
    layer.setStyle((feature: GfsClusterFeature) =>
      styleForFrame(feature, activeFrame),
    );
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
   * Tooltip estático: categoría legible + intensidad máxima del clúster.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onEachFeature(feature: GfsClusterFeature, layer: any) {
    const p = feature.properties;
    if (!p) return;
    const cat = classifyCluster(p);
    if (cat === '-') return;
    const label = GFS_LABEL[cat];
    const mmh = p.max_intensity_mm_h ?? 0;
    layer.bindTooltip(
      `<div style="font-family: var(--eps-font-family-sans); color: var(--eps-text-primary);">
         <strong style="color: var(--eps-primary-main);">${label}</strong><br/>
         <span style="font-size: 12px;">máx ${mmh.toFixed(2)} mm/h</span>
       </div>`,
      { sticky: true, direction: 'top', offset: [0, -5] },
    );
  }

  // === TEMPORAL: en modo 'cells' delegamos todo a la v2 y sólo inyectamos
  // el toggle de comparación. ===
  const portalTarget = map?.getContainer?.()?.parentElement ?? null;
  if (viewMode === 'cells') {
    return (
      <>
        <PrecipitationLayerCells />
        {portalTarget &&
          createPortal(
            <CompareToggle
              viewMode={viewMode}
              onChange={setViewMode}
            />,
            portalTarget,
          )}
      </>
    );
  }

  // === TEMPORAL: confirmar qué geometry llega efectivamente a <GeoJSON> ===
  // eslint-disable-next-line no-console
  console.log('[Clusters] renderData que se pasa a <GeoJSON>:', {
    featuresLen: renderData?.features.length ?? 0,
    feat0_geometry_type: renderData?.features[0]?.geometry?.type,
  });

  if (loading || !renderData) return null;

  return (
    <>
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
        onEachFeature={onEachFeature}
      />

      {/* === TEMPORAL: toggle comparación Clusters | Celdas (abajo-izq) === */}
      {portalTarget &&
        createPortal(
          <CompareToggle viewMode={viewMode} onChange={setViewMode} />,
          portalTarget,
        )}
    </>
  );
}

/**
 * CompareToggle — TEMPORAL. Mini toggle de 2 botones flotante en la esquina
 * inferior izquierda para alternar entre la vista de clústeres (v1) y la
 * vista de celdas individuales (v2, ~12 000).
 *
 * Borrar junto con PrecipitationLayerCells.tsx y `viewMode` en la capa al
 * cerrar la comparación.
 */
interface CompareToggleProps {
  viewMode: 'clusters' | 'cells';
  onChange: (mode: 'clusters' | 'cells') => void;
}

function CompareToggle({ viewMode, onChange }: CompareToggleProps) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 20,
        left: 20,
        zIndex: 1000,
        display: 'flex',
        gap: 0,
        padding: 4,
        borderRadius: 8,
        background: 'rgba(255,255,255,0.95)',
        boxShadow: '0 5px 5px rgba(0,0,0,0.25)',
        fontFamily: 'var(--eps-font-family-sans)',
      }}
      role="group"
      aria-label="Modo de visualización de precipitación (comparación temporal)"
    >
      {(['clusters', 'cells'] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          style={{
            border: 'none',
            cursor: 'pointer',
            padding: '6px 12px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 500,
            color: viewMode === mode ? '#ffffff' : '#170f49',
            background:
              viewMode === mode ? '#070b5b' : 'rgba(255,255,255,0)',
            transition: 'background-color 0.15s',
          }}
        >
          {mode === 'clusters' ? 'Clústeres (v1)' : 'Celdas (v2)'}
        </button>
      ))}
    </div>
  );
}
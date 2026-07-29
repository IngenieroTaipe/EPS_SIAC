import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GeoJSON as GeoJSONComponent, useMap } from 'react-leaflet';
import { GfsForecastSlider } from './GfsForecastSlider';
import { useGfsForecast } from '@/services/useGfsForecast';
import {
  GFS_COLOR_MAP,
  GFS_LABEL,
  getThreshold,
  intensityAt,
  type GfsCategory,
  type GfsFeature,
  type GfsFeatureCollection,
} from '@/features/mapa/types/gfs';

// react-leaflet@5 + @types/leaflet@1.9 bajo moduleResolution: bundler no
// resuelve bien los tipos del componente GeoJSON; cast a `any` como en BaseMap.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GeoJSONAny = GeoJSONComponent as any;

/** Opacidad de relleno para categorías con lluvia (idéntica para todas). */
const FILL_OPACITY_VISIBLE = 0.6;

/**
 * PrecipitationLayer — capa GFS de celdas activas con slider de 12 horas.
 *
 * Renderiza un FeatureCollection de polígonos (~12 000 cells GFS) sobre el
 * mapa Leaflet using **Canvas renderer** (preferCanvas) para performance.
 *
 * Slider flotante (horas):
 *   - Se portal-monta sobre `map.getContainer().parentElement` (mismo
 *     contexto absoluto que LayerControl / MapLegend), sin empujar el layout
 *     externo de las páginas (`HomePage`, `MapaAlertasPage`, etc.).
 *   - Al cambiar el índice, se actualiza `fillColor` / `fillOpacity` de TODOS
 *     los polígonos in-place via `layer.setStyle()` — NO se reconstruye la
 *     capa GeoJSON completa (vital para no congelar el navegador con ~12k
 *     features).
 *
 * Clasificación de color:
 *   Se usa `getThreshold(mmh)` en el frontend porque `threshold_names` aún
 *   viene vacío ('-'). Ver el TODO documentado en
 *   `src/features/mapa/types/gfs.ts`.
 *
 * Tooltip:
 *   Se vincula una sola vez al crear cada feature y muestra la categoría +
 *   intensidad MÁXIMA del periodo (información de un vistazo, independiente
 *   de la hora seleccionada).
 */
export function PrecipitationLayer() {
  const { data, loading } = useGfsForecast();
  // `useMap` siempre retorna una instancia válida dentro de MapContainer.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = useMap() as any;
  // Ref a la capa L.GeoJSON creada por react-leaflet. Cast any porque los
  // tipos no reflejan fielmente el método `setStyle(function)`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geoJsonRef = useRef<any>(null);
  const [hourIndex, setHourIndex] = useState(0);

  // Forzar Canvas renderer para máxima performance con miles de polígonos.
  useEffect(() => {
    if (!map) return;
    map.options.preferCanvas = true;
  }, [map]);

  /**
   * Recalcular estilos al mover el slider. `L.GeoJSON.setStyle()` acepta
   * una función `(feature) => PathOptions` y la aplica a cada sublayer
   * internamente sin reconstruir la capa — óptimo para ~12k features.
   *
   * Deps: `hourIndex` (slider) y `data` (recarga del backend, que también
   * dispara el remount del GeoJSON por el `key`). Refrescar estilos en ambos
   * casos para no dejar la capa con colores obsoletos.
   */
  useEffect(() => {
    const layer = geoJsonRef.current;
    if (!layer) return;
    layer.setStyle((feature: GfsFeature) => styleFor(feature, hourIndex));
  }, [hourIndex, data]);

  /**
   * Computes el estilo de un polígono para una hora dada.
   * Sin lluvia ('-') → invisible (fillOpacity 0); resto → 0.6 sin stroke.
   */
  function styleFor(feature: GfsFeature, idx: number) {
    const mmh = intensityAt(feature, idx);
    const cat: GfsCategory = getThreshold(mmh);
    if (cat === '-') {
      return { fillColor: 'transparent', fillOpacity: 0, stroke: false };
    }
    return {
      fillColor: GFS_COLOR_MAP[cat],
      fillOpacity: FILL_OPACITY_VISIBLE,
      stroke: false,
    };
  }

  /** Tooltip estático: categoría + intensidad máxima del periodo. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function onEachFeature(feature: GfsFeature, layer: any) {
    const mmh = feature.properties?.max_intensity_mm_h ?? 0;
    const cat = getThreshold(mmh);
    if (cat === '-') return;
    const label = GFS_LABEL[cat];
    layer.bindTooltip(
      `<div style="font-family: var(--eps-font-family-sans); color: var(--eps-text-primary);">
         <strong style="color: var(--eps-primary-main);">${label}</strong><br/>
         <span style="font-size: 12px;">máx ${mmh.toFixed(2)} mm/h</span>
       </div>`,
      { sticky: true, direction: 'top', offset: [0, -5] },
    );
  }

  /**
   * Etiquetas legibles "HH:mm" extraídas de `timestamps` (hora local PET).
   * Se toman de la primera feature con array válido — todas las features de
   * una misma corrida comparten los mismos timestamps. Defensivo: si un
   * feature trae `timestamps` undefined o con formato inesperado, se cae a
   * '—' en ese slot sin romper el slider.
   */
  const hours = useMemo<string[]>(() => {
    const feats = (data as GfsFeatureCollection | null)?.features ?? [];
    for (const f of feats) {
      const ts = f.properties?.timestamps;
      if (Array.isArray(ts) && ts.length > 0) {
        return ts.map((raw) => {
          if (typeof raw !== 'string' || !raw) return '—';
          // Formato esperado: "2026-07-28 14:00 PET".
          const m = raw.match(/(\d{2}:\d{2})/);
          return m ? m[1] : raw;
        });
      }
    }
    return [];
  }, [data]);

  if (loading || !data) return null;

  // Contenedor del mapa (MapContainer) → su padre es el wrapper `relative`
  // que aloja LayerControl/MapLegend. Ahí portaleamos el slider para que
  // flote sobre el mapa con el mismo contexto absoluto, sin afectar layout.
  const portalTarget = map?.getContainer?.()?.parentElement ?? null;

  return (
    <>
      <GeoJSONAny
        // El `key` cambia solo cuando cambia el request_code (nueva corrida):
        // fuerza remount del GeoJSON y evita datos obsoletos mezclados.
        key={`gfs-${data.metadata?.request_code ?? ''}`}
        data={data}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ref={(layer: any) => {
          geoJsonRef.current = layer;
        }}
        style={(feature: GfsFeature) => styleFor(feature, hourIndex)}
        onEachFeature={onEachFeature}
      />

      {/* Slider portaled sobre el wrapper del mapa (no empuja el layout). */}
      {portalTarget &&
        createPortal(
          <GfsForecastSlider
            hours={hours}
            value={hourIndex}
            onChange={setHourIndex}
          />,
          portalTarget,
        )}
    </>
  );
}
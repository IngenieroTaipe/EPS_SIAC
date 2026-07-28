import { useEffect } from 'react';
import { GeoJSON as GeoJSONComponent, useMap } from 'react-leaflet';
import {
  PRECIP_FILL,
  PRECIP_FILL_OPACITY,
  PRECIP_STROKE,
  PRECIP_LABEL,
  type PrecipNivel,
} from '../types/precipitacion';
import { usePrecipitaciones } from '@/services/usePrecipitaciones';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GeoJSONAny = GeoJSONComponent as any;

/**
 * PrecipitationLayer — capa de precipitaciones renderizada como FeatureCollection
 * de polígonos sobre el mapa.
 *
 * Consume el GeoJSON del backend (última solicitud ECMWF completada) via
 * `usePrecipitaciones`. Si no hay token o falla, cae al mock estático.
 *
 * Optimización: usa **Canvas renderer** en vez de SVG para poder renderizar
 * miles de polígonos (4081 celdas ECMWF) sin congelar el navegador.
 *
 * Filtra automáticamente por el distrito seleccionado en el contexto de
 * Unidad Operativa (via `intersected_districts`).
 */
export function PrecipitationLayer() {
  const { data, loading } = usePrecipitaciones();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = useMap() as any;

  // Forzar Canvas renderer para máxima performance con miles de polígonos.
  useEffect(() => {
    if (!map) return;
    // Prefer canvas over svg for rendering many polygons.
    map.options.preferCanvas = true;
  }, [map]);

  if (loading || !data) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function featureStyle(feature?: any) {
    const nivel: PrecipNivel = feature?.properties?.nivel ?? 'moderadamente-lluvioso';
    return {
      fillColor: PRECIP_FILL[nivel],
      fillOpacity: PRECIP_FILL_OPACITY[nivel],
      color: PRECIP_STROKE[nivel],
      weight: 1,
      opacity: 0.8,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function bindTooltip(feature: any, layer: any) {
    const props = feature?.properties ?? {};
    const nivel: PrecipNivel = props.nivel ?? 'moderadamente-lluvioso';
    const mmh = typeof props.mm_h === 'number' ? `${props.mm_h} mm/h` : '—';
    const label = PRECIP_LABEL[nivel];
    const accumulated =
      typeof props.accumulated_period_mm === 'number'
        ? `${props.accumulated_period_mm} mm acumulado`
        : '';

    layer.bindTooltip(
      `<div style="font-family: var(--eps-font-family-sans); color: var(--eps-text-primary);">
         <strong style="color: var(--eps-primary-main);">${label}</strong><br/>
         <span style="font-size: 12px;">${mmh}</span>${accumulated ? `<br/><span style="font-size: 11px; color: var(--eps-text-secondary);">${accumulated}</span>` : ''}
       </div>`,
      { sticky: true, direction: 'top', offset: [0, -5] },
    );
  }

  return (
    <GeoJSONAny
      key={JSON.stringify(data).slice(0, 80)}
      data={data}
      style={featureStyle}
      onEachFeature={bindTooltip}
    />
  );
}
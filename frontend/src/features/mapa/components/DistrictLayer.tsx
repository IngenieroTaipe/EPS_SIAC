import { useEffect, useMemo, useRef } from 'react';
import { GeoJSON as GeoJSONComponent, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useUnidadOperativa } from '@/shared/context/useUnidadOperativa';
import { UNIDAD_TODAS } from '@/shared/context/UnidadOperativaContext';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GeoJSONAny = GeoJSONComponent as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Lany = L as any;

/**
 * DistrictLayer — dibuja los contornos de los distritos asociados a las
 * unidades operativas activas (branches) y hace zoom al seleccionado.
 * Permite click en un contorno para seleccionarlo.
 *
 * Se coloca dentro de <BaseMap>.
 */
export function DistrictLayer() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = useMap() as any;
  const { districts, branches, selectedNombre, setSelectedNombre, loading } =
    useUnidadOperativa();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geoJsonLayerRef = useRef<any>(null);

  // Mapa ubigeo → nombre del branch (label amigable para tooltip/selección).
  const ubigeoToBranchName = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of branches) {
      const ub = typeof b.district === 'string' ? b.district : b.district?.ubigeo;
      if (ub) m.set(ub, b.name);
    }
    return m;
  }, [branches]);

  // Distritos (con geojson) que pertenecen a un branch activo.
  const targetDistricts = useMemo(() => {
    return districts.filter((d) => {
      if (!d.geojson) return false;
      return ubigeoToBranchName.has(d.ubigeo);
    });
  }, [districts, ubigeoToBranchName]);

  // FeatureCollection de los distritos operativos.
  const featureCollection = useMemo(() => {
    if (targetDistricts.length === 0) return null;
    const features = targetDistricts.map((d) => {
      const label = ubigeoToBranchName.get(d.ubigeo) ?? d.name;
      return {
        type: 'Feature' as const,
        properties: {
          ubigeo: d.ubigeo,
          name: d.name,
          label,
        },
        geometry: d.geojson,
      };
    });
    return { type: 'FeatureCollection' as const, features };
  }, [targetDistricts, ubigeoToBranchName]);

  // Auto-zoom cuando cambia la selección.
  useEffect(() => {
    if (!map || targetDistricts.length === 0) return;

    if (selectedNombre === UNIDAD_TODAS || !selectedNombre) {
      // "Todas" → encuadrar los distritos operativos.
      try {
        const bounds = Lany.latLngBounds([]);
        targetDistricts.forEach((d) => {
          if (d.geojson) {
            const tempLayer = Lany.geoJSON(d.geojson);
            bounds.extend(tempLayer.getBounds());
          }
        });
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [30, 30], animate: true });
        }
      } catch {
        // ignore
      }
      return;
    }

    // Buscar el distrito seleccionado por nombre de branch.
    const selectedUb = Array.from(ubigeoToBranchName.entries()).find(
      ([, name]) => name === selectedNombre,
    )?.[0];
    const selectedDist = selectedUb
      ? targetDistricts.find((d) => d.ubigeo === selectedUb)
      : undefined;

    if (selectedDist && selectedDist.geojson) {
      try {
        const layer = Lany.geoJSON(selectedDist.geojson);
        const bounds = layer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13, animate: true });
        }
      } catch {
        // ignore
      }
    }
  }, [selectedNombre, targetDistricts, ubigeoToBranchName, map]);

  if (loading || !featureCollection) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const styleFeature = (feature: any) => {
    const isSelected =
      selectedNombre !== UNIDAD_TODAS &&
      feature?.properties?.label === selectedNombre;

    return {
      fillColor: 'transparent',
      fillOpacity: 0,
      color: isSelected ? '#0284C7' : '#2563EB',
      weight: isSelected ? 3.5 : 2,
      opacity: 0.85,
      dashArray: isSelected ? undefined : '4, 4',
    };
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onEachFeature = (feature: any, layer: any) => {
    const label = feature?.properties?.label ?? feature?.properties?.name;
    if (label) {
      layer.bindTooltip(label, {
        permanent: false,
        direction: 'center',
        className:
          'bg-slate-900/90 text-white text-xs font-semibold px-2 py-1 rounded shadow-md border-0',
      });
    }
    layer.on({
      mouseover: (e: { target: { setStyle: (s: unknown) => void } }) => {
        e.target.setStyle({ weight: 3.5, color: '#1D4ED8', opacity: 1 });
      },
      mouseout: (e: { target: unknown }) => {
        if (geoJsonLayerRef.current) {
          geoJsonLayerRef.current.resetStyle(e.target);
        }
      },
      click: () => {
        if (label) setSelectedNombre(label);
      },
    });
  };

  return (
    <GeoJSONAny
      ref={geoJsonLayerRef}
      key={`districts-${selectedNombre}-${targetDistricts.length}`}
      data={featureCollection}
      style={styleFeature}
      onEachFeature={onEachFeature}
    />
  );
}
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { cn } from '@/shared/lib/cn';
import {
  CRITICIDAD_LABEL,
  TIPO_LABEL,
  type Componente,
  type CriticidadComponente,
  type TipoComponente,
} from '@/features/mapa/types/componente';
import { ComponentLayer } from '@/features/mapa/components/ComponentLayer';
import {
  latLonToUtm,
  utmToLatLon,
  ZONA_LETRA_DEFAULT,
  ZONA_UTM_DEFAULT,
} from '../utm-utils';

// Iconos del componente (SVG importados como URL para el icono delSidebar).
import CaptacionIconUrl from '@/assets/icons/captacion.svg?url';
import ReservorioIconUrl from '@/assets/icons/reservorio.svg?url';
import PlantaTratamientoIconUrl from '@/assets/icons/planta-tratamiento.svg?url';
import LineaConduccionIconUrl from '@/assets/icons/linea-conduccion.svg?url';

/**
 * EditorComponente — formulario de creación/edición de un componente.
 *
 * Layout según Figma:
 *   ┌─ Tarjeta izquierda (datos)      ──┐  ┌─ Tarjeta derecha ──┐
 *   │ Tipo (select) + Icono preview    │  │ Mapa referencial    │
 *   │ Código                           │  │  (_otro mapa leaflet│
 *   │ Unidad Operativa (select)        │  │   mostrando todos   │
 *   │ Estado Operacional (select)      │  │   los componentes + │
 *   │ Estado Físico (select)           │  │   el que se edita  │
 *   │ Criticidad (alta/media/baja)     │  │   resaltado)        │
 *   │ Especificación (textarea)        │  ├─────────────────────┤
 *   │ Coordenadas UTM (E/N)            │  │ Vista previa       │
 *   │ Coordenadas Lat/Lon (auto-fill)  │  │ (resumen de campos) │
 *   └───────────────────────────────────┘  └───────────────────────┘
 *
 * Comportamiento:
 *   - El icono junto al título "Ícono" cambia según el tipo seleccionado.
 *   - La criticidad se selecciona entre 3 botones (alta/media/baja) que
 *     se resaltan con su color de marca (rojo/naranja/verde).
 *   - Lat/Lon se recalcula automáticamente desde UTM (editando E/N);
 *     o UTM se recalcula desde Lat/Lon (aunque Lat/Lon se genera desde UTM,
 *     podría añadirse inputs editables; por ahora siguen read-only).
 *   - El mapa al costado muestra el componente en edición con su icono,
 *     junto con los otros componentes del sistema para referencia.
 *   - Botones footer: "Cancelar" vuelve al histórico de componentes;
 *     "Guardar Componente" confirma el mock + vuelve al histórico.
 *
 * Contrato backend (cuando esté listo):
 *   POST /api/components/         (crear)
 *   PATCH /api/components/:id/    (editar)
 *   → response: Componente actualizado
 */

const ICON_URL_BY_TIPO: Record<TipoComponente, string> = {
  'captacion': CaptacionIconUrl,
  'planta-tratamiento': PlantaTratamientoIconUrl,
  'reservorio': ReservorioIconUrl,
  'linea-conduccion': LineaConduccionIconUrl,
};

const CRITICIDAD_CLASES: Record<
  CriticidadComponente,
  { selected: string; unselected: string }
> = {
  'alta': {
    selected: 'bg-danger-states-hover outline-danger-main text-danger-dark',
    unselected: 'bg-background-main outline-button-stroke text-text-secondary hover:bg-danger-states-hover/30',
  },
  'media': {
    selected: 'bg-warning-states-hover outline-warning-main text-warning-dark',
    unselected: 'bg-background-main outline-button-stroke text-text-secondary hover:bg-warning-states-hover/30',
  },
  'baja': {
    selected: 'bg-success-states-hover outline-success-main text-success-dark',
    unselected: 'bg-background-main outline-button-stroke text-text-secondary hover:bg-success-states-hover/30',
  },
};

const STATE_BADGE_GENERIC = 'bg-text-status-placeholder rounded-full px-3 py-[3px] text-xs font-bold font-sans';

const UNIDADES = ['Pichanaqui', 'San Ramón', 'La Merced', 'Oxapampa', 'Satipo'];
const TIPOS: Array<{ value: Exclude<TipoComponente, 'linea-conduccion'>; label: string }> = [
  { value: 'captacion', label: 'Captación' },
  { value: 'planta-tratamiento', label: 'Planta de Tratamiento' },
  { value: 'reservorio', label: 'Reservorio' },
];
const ESTADOS_OPERACIONAL = ['Operativo', 'Inoperativo', 'En reserva'];
const ESTADOS_FISICO = ['Bueno', 'Regular', 'Malo'];

interface EditorComponenteProps {
  /** Componente a editar. Si se omite, se crea uno nuevo. */
  initial?: Componente;
}

export function EditorComponente({ initial }: EditorComponenteProps) {
  const navigate = useNavigate();

  // ── Estado del formulario ─────────────────────────────────────────
  const [tipo, setTipo] = useState<Exclude<TipoComponente, 'linea-conduccion'>>(
    initial?.tipo ?? 'captacion',
  );
  const [codigo, setCodigo] = useState(initial?.codigo ?? '');
  const [unidad, setUnidad] = useState(initial?.unidadOperativa ?? 'Pichanaqui');
  const [estadoOperacional, setEstadoOperacional] = useState<string>('Operativo');
  const [estadoFisico, setEstadoFisico] = useState<string>('Bueno');
  const [criticidad, setCriticidad] = useState<CriticidadComponente>(
    initial?.criticidad ?? 'baja',
  );
  const [especificacion, setEspecificacion] = useState(initial?.especificacion ?? '');

  // ── Coordenadas: UTM ↔ LatLon ──────────────────────────────────────
  const initUtm = initial
    ? latLonToUtm(initial.lat, initial.lng, ZONA_UTM_DEFAULT)
    : { easting: 0, northing: 0 };

  const [utmE, setUtmE] = useState<string>(String(initUtm.easting));
  const [utmN, setUtmN] = useState<string>(String(initUtm.northing));
  const [lat, setLat] = useState<number>(initial?.lat ?? 0);
  const [lon, setLon] = useState<number>(initial?.lng ?? 0);

  function handleUtmChange(field: 'e' | 'n', value: string) {
    if (field === 'e') setUtmE(value);
    else setUtmN(value);

    const e = parseFloat(field === 'e' ? value : utmE);
    const n = parseFloat(field === 'n' ? value : utmN);
    if (isNaN(e) || isNaN(n)) return;
    try {
      const { latitude, longitude } = utmToLatLon(e, n, ZONA_UTM_DEFAULT, ZONA_LETRA_DEFAULT);
      setLat(Math.round(latitude * 1e6) / 1e6);
      setLon(Math.round(longitude * 1e6) / 1e6);
    } catch {
      // Si los valores no son válidos para conversión, no actualiza.
    }
  }

  const MAX = 300;
  const especificacionTruncada = especificacion.slice(0, MAX);

  function handleGuardar() {
    // Mock: solo navega al histórico. Aquí se llamaría al backend.
    navigate('/componentes/gestion');
  }

  function handleCancelar() {
    navigate('/componentes/gestion');
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Cuerpo: 40% izquierda (datos) + 60% derecha (mapa+vistaprevia) ── */}
      <div className="flex-1 overflow-y-auto px-8 py-6 flex justify-center items-stretch gap-6">
        {/* Tarjeta izquierda — Datos del componente (40%) */}
        <div className="w-[40%] min-w-[600px] max-w-[743px] p-6 rounded-2xl outline outline-1 outline-offset-[-1px] outline-input-stroke-main flex flex-col gap-5 bg-background-main">
          <h2 className="text-text-primary text-lg font-bold font-sans leading-7">
            Datos del componente
          </h2>

          {/* Tipo de componente + Icono preview */}
          <div className="flex gap-4">
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-text-primary text-xs font-medium font-sans">
                Tipo de Componente
              </label>
              <SelectInput
                value={tipo}
                onChange={(v) => setTipo(v as typeof tipo)}
                options={TIPOS.map((t) => ({ value: t.value, label: t.label }))}
                placeholder="Seleccionar tipo de componente"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-text-primary text-sm font-medium font-sans">Ícono</label>
              <div className="size-16 py-3.5 rounded-xl border border-button-stroke grid place-items-center bg-background-main">
                <img src={ICON_URL_BY_TIPO[tipo]} alt="" className="w-10 h-10" />
              </div>
            </div>
          </div>

          {/* Código */}
          <Field label="Código">
            <input
              type="text"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Ej. 008"
              className="w-full bg-background-main rounded-xl outline outline-1 outline-offset-[-1px] outline-button-stroke px-4 py-3 text-text-primary text-sm font-sans focus:outline-2 focus:outline-primary-main"
            />
          </Field>

          {/* Unidad operativa */}
          <Field label="Unidad Operativa">
            <SelectInput
              value={unidad}
              onChange={setUnidad}
              options={UNIDADES.map((u) => ({ value: u, label: u }))}
              placeholder="Seleccionar unidad operativa"
            />
          </Field>

          {/* Estado operacional + Físico */}
          <div className="flex gap-4">
            <Field label="Estado Operacional" inline>
              <SelectInput
                value={estadoOperacional}
                onChange={setEstadoOperacional}
                options={ESTADOS_OPERACIONAL.map((e) => ({ value: e, label: e }))}
                placeholder="Seleccionar estado"
              />
            </Field>
            <Field label="Estado Físico" inline>
              <SelectInput
                value={estadoFisico}
                onChange={setEstadoFisico}
                options={ESTADOS_FISICO.map((e) => ({ value: e, label: e }))}
                placeholder="Seleccionar estado"
              />
            </Field>
          </div>

          {/* Criticidad — 3 botones seleccionables */}
          <div className="flex flex-col gap-2">
            <span className="text-text-primary text-xs font-medium font-sans">Criticidad</span>
            <div className="flex gap-3">
              {(Object.keys(CRITICIDAD_LABEL) as CriticidadComponente[]).map((c) => {
                const isOn = criticidad === c;
                const cls = CRITICIDAD_CLASES[c];
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCriticidad(c)}
                    className={cn(
                      'w-28 py-2 rounded-xl outline outline-1 outline-offset-[-1px] text-sm font-medium font-sans transition-colors',
                      isOn ? cls.selected : cls.unselected,
                    )}
                  >
                    {CRITICIDAD_LABEL[c]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Especificación */}
          <Field label="Especificación (descripción - observaciones)">
            <textarea
              value={especificacionTruncada}
              onChange={(e) => setEspecificacion(e.target.value.slice(0, MAX))}
              placeholder="Ingrese una descripción u observaciones del componente..."
              className="w-full bg-background-main rounded-xl outline outline-1 outline-offset-[-1px] outline-button-stroke px-4 pt-3 pb-3 text-text-primary text-sm font-sans resize-none min-h-24 focus:outline-2 focus:outline-primary-main"
            />
            <span className="self-end text-text-secondary text-xs font-sans">
              {especificacionTruncada.length}/{MAX}
            </span>
          </Field>

          {/* Coordenadas UTM → LatLon */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <span className="text-text-primary text-sm font-medium font-sans">
                Coordenadas UTM
              </span>
            </div>
            <span className="text-text-secondary text-xs font-sans">
              Ingrese las coordenadas UTM y se transformarán automáticamente a Latitud y Longitud.
            </span>

            <div className="pt-2 flex gap-3 items-end">
              <Field label="Este (X)" inline>
                <input
                  type="number"
                  value={utmE}
                  onChange={(e) => handleUtmChange('e', e.target.value)}
                  placeholder="Ej. 463529.00"
                  className="w-full bg-background-main rounded-xl outline outline-1 outline-offset-[-1px] outline-button-stroke px-4 py-3 text-text-primary text-sm font-sans focus:outline-2 focus:outline-primary-main"
                />
              </Field>
              <div className="w-5 pb-3" />
              <Field label="Norte (Y)" inline>
                <input
                  type="number"
                  value={utmN}
                  onChange={(e) => handleUtmChange('n', e.target.value)}
                  placeholder="Ej. 8777285.00"
                  className="w-full bg-background-main rounded-xl outline outline-1 outline-offset-[-1px] outline-button-stroke px-4 py-3 text-text-primary text-sm font-sans focus:outline-2 focus:outline-primary-main"
                />
              </Field>
            </div>

            <div className="pt-3 flex gap-3">
              <ReadonlyField label="Latitud" value={lat.toString()} />
              <ReadonlyField label="Longitud" value={lon.toString()} />
            </div>
          </div>
        </div>

        {/* Tarjeta derecha — Mapa referencial (más grande) + vista previa (60%) */}
        <div className="flex-1 flex flex-col gap-6">
          <MapaReferencial lat={lat} lon={lon} iconUrl={ICON_URL_BY_TIPO[tipo]} />
          <VistaPrevia
            tipo={TIPO_LABEL[tipo]}
            lat={lat}
            lon={lon}
            utmE={utmE}
            utmN={utmN}
            unidad={unidad}
            estadoOperacional={estadoOperacional}
            estadoFisico={estadoFisico}
            criticidad={criticidad}
          />
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div className="px-8 py-5 border-t border-button-stroke inline-flex justify-end items-center gap-3 bg-background-main">
        <button
          type="button"
          onClick={handleCancelar}
          className="px-6 py-2.5 rounded-xl outline outline-1 outline-offset-[-1px] outline-button-stroke text-text-primary text-sm font-medium font-sans hover:bg-primary-states-hover-main/30 transition-colors
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main focus-visible:ring-offset-2"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleGuardar}
          className="px-6 py-2.5 rounded-xl bg-primary-main text-text-invert-primary text-sm font-medium font-sans
                     inline-flex justify-start items-center gap-2
                     hover:bg-primary-light transition-colors
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main focus-visible:ring-offset-2"
        >
          <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
            <path
              d="M3 7L7 11L13 4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.33"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Guardar Componente
        </button>
      </div>
    </div>
  );
}

// ── Subcomponentes ───────────────────────────────────────────────────

function Field({
  label,
  children,
  inline = false,
}: {
  label: string;
  children: React.ReactNode;
  inline?: boolean;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', inline ? 'flex-1' : 'w-full')}>
      <label className="text-text-primary text-sm font-medium font-sans">{label}</label>
      {children}
    </div>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 px-4 py-3 bg-text-status-placeholder/30 rounded-xl flex flex-col gap-1">
      <span className="text-text-secondary text-xs font-sans">{label}</span>
      <span className="text-text-primary text-sm font-medium font-sans">{value}</span>
    </div>
  );
}

function SelectInput({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
}) {
  const showPlaceholder = !value;
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full px-4 py-2.5 rounded-xl outline outline-1 outline-offset-[-1px] outline-button-stroke appearance-none pr-10',
          'text-sm font-sans bg-background-main',
          showPlaceholder ? 'text-text-secondary' : 'text-text-primary',
          'focus:outline-2 focus:outline-primary-main',
        )}
      >
        {showPlaceholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-icon-main pointer-events-none"
        strokeWidth={2}
        aria-hidden="true"
      />
    </div>
  );
}

/**
 * MapaReferencial — contenedor del mini-mapa Leaflet en el editor.
 *
 * Muestra el componente en edición + todos los demás (vía ComponentLayer)
 * para que el usuario vea la relación con la red. Permite zoom/pan.
 * Al cambiar las coordenadas (lat/lon) en el formulario, el mapa hace
 * pan automático al nuevo punto con zoom 15.
 */
function MapaReferencial({ lat, lon, iconUrl }: { lat: number; lon: number; iconUrl: string }) {
  return (
    <div className="flex-1 min-h-[500px] p-6 rounded-2xl outline outline-1 outline-offset-[-1px] outline-input-stroke-main flex flex-col gap-4 bg-background-main">
      <div className="flex items-center gap-2">
        <h3 className="text-text-primary text-lg font-bold font-sans">
          Ubicación del componente
        </h3>
        <span className="px-2.5 py-1 bg-primary-states-hover-main/30 rounded-full text-text-secondary text-xs font-medium font-sans">
          Vista referencial
        </span>
      </div>
      <MiniMapa lat={lat} lon={lon} iconUrl={iconUrl} />
    </div>
  );
}

/**
 * AutoPan — componente helper que observa `lat/lon` y hace pan+zoom al
 * nuevo punto cuando cambia. Vive dentro del `<MapContainer>` (usa useMap).
 */
function AutoPan({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    if (lat === 0 && lon === 0) return; // No pan si aún no hay coords.
    map.setView([lat, lon], 15, { animate: true });
  }, [lat, lon, map]);
  return null;
}

/** Vista previa —卡片 resumen de datos. */
function VistaPrevia({
  tipo,
  lat,
  lon,
  utmE,
  utmN,
  unidad,
  estadoOperacional,
  estadoFisico,
  criticidad,
}: {
  tipo: string;
  lat: number;
  lon: number;
  utmE: string;
  utmN: string;
  unidad: string;
  estadoOperacional: string;
  estadoFisico: string;
  criticidad: CriticidadComponente;
}) {
  return (
    <div className="self-stretch p-6 rounded-2xl outline outline-1 outline-offset-[-1px] outline-text-status-placeholder flex flex-col gap-4 bg-background-main">
      <h3 className="text-text-primary text-lg font-bold font-sans">
        Vista previa del componente
      </h3>
      <div className="flex flex-col gap-3">
        <Fila label="Tipo:" value={tipo} />
        <Fila
          label="Ubicación:"
          value={`Lat: ${lat.toFixed(6)}, Long: ${lon.toFixed(6)}`}
        />
        <Fila label="UTM:" value={`E: ${utmE}, N: ${utmN}`} />
        <Fila label="Unidad Operativa:" value={unidad} />
        <Fila
          label="Estado Operacional:"
          value={estadoOperacional}
          badgeColor={STATE_BADGE_GENERIC}
        />
        <Fila
          label="Estado Físico:"
          value={estadoFisico}
          badgeColor={STATE_BADGE_GENERIC}
        />
        <Fila
          label="Criticidad:"
          value={CRITICIDAD_LABEL[criticidad]}
          badgeColor={
            criticidad === 'alta'
              ? 'bg-secondary-hover rounded-full px-3 py-[3px] text-xs font-bold font-sans text-secondary-main'
              : criticidad === 'media'
                ? 'bg-warning-states-hover rounded-full px-3 py-[3px] text-xs font-bold font-sans text-warning-dark'
                : 'bg-success-states-hover rounded-full px-3 py-[3px] text-xs font-bold font-sans text-success-dark'
          }
        />
      </div>
    </div>
  );
}

function Fila({
  label,
  value,
  badgeColor,
}: {
  label: string;
  value: string;
  badgeColor?: string;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-text-status-placeholder text-sm font-normal font-sans">{label}</span>
      {badgeColor ? (
        <span className={badgeColor}>{value}</span>
      ) : (
        <span className="text-text-primary text-sm font-medium font-sans">{value}</span>
      )}
    </div>
  );
}

/**
 * MiniMapa — renderiza un mapa Leaflet similar al `MapaComponentes` pero
 * en miniatura. Permite zoom/pan (scrollWheelZoom activo), muestra todos
 * los componentes existentes via `ComponentLayer` y un marker destacado
 * para el componente en edición.
 *
 * Al cambiar `lat/lon` (desde UTM o edición directa), el componente
 * `AutoPan` mueve el centro y ajusta el zoom a 15.
 */
function MiniMapa({
  lat,
  lon,
  iconUrl,
}: {
  lat: number;
  lon: number;
  iconUrl: string;
}) {
  // Cast a any para evitar el bug de tipos de react-leaflet@5 + @types/leaflet
  // bajo TS6 moduleResolution: bundler. Mismo workaround que el resto del mapa.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MapContainerAny = MapContainer as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const TileLayerAny = TileLayer as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MarkerAny = Marker as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Lany = L as any;

  // Icono destacado del componente en edición (40x40 + yellow ring).
  const icon = Lany.divIcon({
    html: `<div style="
      display:grid;place-items:center;width:40px;height:40px;
      background: var(--eps-background-selected);
      border-radius: 50%;
      box-shadow: 0 0 0 4px var(--eps-background-selected);
    "><img src="${iconUrl}" style="width:32px;height:32px;" alt=""/></div>`,
    className: 'mini-marker-selected',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

  // Centro inicial: si hay coordenadas válidas, usa esas; si no, Pichanaqui.
  const center: [number, number] =
    lat !== 0 && lon !== 0 ? [lat, lon] : [-11.019, -75.297];

  // `key` cambia si `center` cambia meaningfulmente, así react-leaflet
  // remonta el MapContainer con el nuevo `center`. Esto permite que el
  // `AutoPan` (que usa `useMap`) tenga tiempo de ajustar el centro sin
  // conflictos con el `center` inicial.
  const mapKey = `mini-${lat.toFixed(4)}-${lon.toFixed(4)}`;

  return (
    <div className="flex-1 rounded-2xl overflow-hidden border border-input-stroke-main min-h-[400px]">
      <MapContainerAny
        key={mapKey}
        center={center}
        zoom={15}
        scrollWheelZoom
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayerAny
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap'
        />
        {/* Componentes del sistema (para ver la relación con los demás). */}
        <ComponentLayer />
        {/* AutoPan ajusta el centro cuando cambian lat/lon. */}
        <AutoPan lat={lat} lon={lon} />
        {/* Marker destacado del componente en edición. */}
        <MarkerAny position={center} icon={icon} />
      </MapContainerAny>
    </div>
  );
}
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { cn } from '@/shared/lib/cn';
import {
  type Componente,
  type TipoComponente,
  TIPO_LABEL,
  TIPO_LINEA,
} from '@/features/mapa/types/componente';
import { ComponentLayer } from '@/features/mapa/components/ComponentLayer';
import {
  latLonToUtm,
  utmToLatLon,
  ZONA_LETRA_DEFAULT,
  ZONA_UTM_DEFAULT,
} from '../utm-utils';
import { apiComponentes } from '@/services/apiComponentes';
import { apiPlaces, type BackendDistrict } from '@/services/apiPlaces';
import { mapTipo } from '@/services/adaptadores';
import { FilterableSelect } from '@/shared/components/FilterableSelect';
import type { BackendComponentListCoord } from '@/services/apiComponentes';

// Iconos del componente (SVG importados como URL para el icono delSidebar).
import CaptacionIconUrl from '@/assets/icons/captacion.svg?url';
import ReservorioIconUrl from '@/assets/icons/reservorio.svg?url';
import PlantaTratamientoIconUrl from '@/assets/icons/planta-tratamiento.svg?url';
import LineaConduccionIconUrl from '@/assets/icons/linea-conduccion.svg?url';
import CircleIconUrl from '@/assets/icons/circle.svg?url';

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
  'fuente': CaptacionIconUrl,
  'planta-tratamiento': PlantaTratamientoIconUrl,
  'planta-aguas-residuales': PlantaTratamientoIconUrl,
  'reservorio': ReservorioIconUrl,
  'linea-conduccion': LineaConduccionIconUrl,
  'linea-aduccion': LineaConduccionIconUrl,
  'estacion-bombeo': CircleIconUrl,
  'desinfeccion': CircleIconUrl,
  'purgado-redes': CircleIconUrl,
  'otro': CircleIconUrl,
};

const STATE_BADGE_GENERIC = 'bg-text-status-placeholder rounded-full px-3 py-[3px] text-xs font-bold font-sans';

type OpcionSelect = { value: string; label: string };

interface EditorComponenteProps {
  /** Componente a editar. Si se omite, se crea uno nuevo. */
  initial?: Componente;
  /** Datos crudos del backend para precargar selects (IDs/codes). */
  initialBackend?: {
    typeId?: number;
    districtUbigeo?: string;
    operationalStatusCode?: string;
    physicalStatusCode?: string;
    criticalityId?: number;
    /** Coords existentes traidas del retrieve (con id, criticality nombre, geojson). */
    coords?: BackendComponentListCoord[];
    /** Nombre de la criticidad (viene como StringRelatedField en la coord embebida). */
    criticalityName?: string;
  };
}

/**
 * Punto de la línea/punto en edición. `id` solo si ya existe en backend
 * (PATCH); undefined si es nuevo (POST).
 */
type Punto = {
  id?: number;
  east: string;
  north: string;
  criticalityId: string;
  /** nombre de criticidad precargado (para mapear al id al cargar catalogo). */
  criticalityName?: string;
};

/** Punto con su lat/lon derivado (memo) para el mapa y la vista previa. */
type PuntoConLatLon = Punto & { lat: number; lon: number; valido: boolean };

export function EditorComponente({ initial, initialBackend }: EditorComponenteProps) {
  const navigate = useNavigate();

  // ── Estado del formulario ─────────────────────────────────────────
  const [tipoId, setTipoId] = useState<string>(initialBackend?.typeId ? String(initialBackend.typeId) : '');
  // `tipoLabel` guarda el nombre legible del backend (ej. "CAPTACIÓN").
  // La clave interna (TipoComponente) se deriva con `mapTipo(tipoLabel)`.
  const [tipoLabel, setTipoLabel] = useState<string>(
    initial ? TIPO_LABEL[initial.tipo] : '',
  );
  const [codigo, setCodigo] = useState(initial?.codigo ?? '');
  const [nombre, setNombre] = useState(initial?.nombre ?? '');
  const [distritoUbigeo, setDistritoUbigeo] = useState<string>(initialBackend?.districtUbigeo ?? '');
  const [estadoOperacionalCode, setEstadoOperacionalCode] = useState<string>(initialBackend?.operationalStatusCode ?? '');
  const [estadoFisicoCode, setEstadoFisicoCode] = useState<string>(initialBackend?.physicalStatusCode ?? '');
  const [especificacion, setEspecificacion] = useState(initial?.especificacion ?? '');

  // ── Lista de puntos (coordenadas) del componente ───────────────────
  // Para tipos "LÍNEA DE CONDUCCIÓN" y "LÍNEA DE ADUCCIÓN" puede haber
  // N puntos; para el resto de tipos se mantiene 1 solo.
  const inicialPuntos: Punto[] = useMemo(() => {
    const coords = initialBackend?.coords ?? [];
    if (coords.length > 0) {
      return coords.map((c) => {
        const lat = c.geojson?.coordinates?.[1] ?? 0;
        const lon = c.geojson?.coordinates?.[0] ?? 0;
        const utm = lat !== 0 || lon !== 0
          ? latLonToUtm(lat, lon, ZONA_UTM_DEFAULT)
          : { easting: 0, northing: 0 };
        return {
          id: c.id,
          east: String(utm.easting),
          north: String(utm.northing),
          criticalityId: c.criticality?.id ? String(c.criticality.id) : '',
          criticalityName: c.criticality?.name,
        };
      });
    }
    // Componente nuevo o sin coords previas: partir de 1 punto vacío.
    return [{ east: '', north: '', criticalityId: '' }];
  }, [initialBackend]);

  const [puntos, setPuntos] = useState<Punto[]>(inicialPuntos);
  // Cuando cambian los coords iniciales (ej. abre otra edición) sincronizamos.
  // (No se incluye en el efecto de catálogo para no pisar edits del usuario.)
  /* eslint-disable react-hooks/set-state-in-effect -- sincronizacion de
     state cuando cambian los coords iniciales al cargar otra edicion
     (mismo patrón que el resto del código: GestionUmbrales, EditorUmbral). */
  useEffect(() => { setPuntos(inicialPuntos); }, [inicialPuntos]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ── Opciones dinámicas desde el backend ────────────────────────────
  const [tiposOptions, setTiposOptions] = useState<OpcionSelect[]>([]);
  const [distritosOptions, setDistritosOptions] = useState<BackendDistrict[]>([]);
  const [estadosOpOptions, setEstadosOpOptions] = useState<OpcionSelect[]>([]);
  const [estadosFisOptions, setEstadosFisOptions] = useState<OpcionSelect[]>([]);
  const [criticidadesOptions, setCriticidadesOptions] = useState<OpcionSelect[]>([]);

  useEffect(() => {
    Promise.all([
      apiComponentes.listTipos(),
      apiPlaces.listDistrictsLight(),
      apiComponentes.listEstadosOperacionales(),
      apiComponentes.listEstadosFisicos(),
      apiComponentes.listCriticidades(),
    ])
      .then(([tipos, dists, ops, fis, crits]) => {
        setTiposOptions(tipos.map((t) => ({ value: String(t.id), label: t.name })));
        setDistritosOptions(dists);
        setEstadosOpOptions(ops.map((o) => ({ value: o.code, label: o.name })));
        setEstadosFisOptions(fis.map((f) => ({ value: f.code, label: f.name })));
        setCriticidadesOptions(crits.map((c) => ({ value: String(c.id), label: c.name })));

        // Criticidad de cada punto: el backend trae solo el *nombre* de la
        // criticidad (StringRelatedField en la coord embebida), no el id.
        // Mapeamos nombre→id por coincidencia de los 3 primeros caracteres.
        setPuntos((prev) =>
          prev.map((p) => {
            if (p.criticalityId || !p.criticalityName) return p;
            const nombre = p.criticalityName.toUpperCase().trim();
            const match = crits.find((c) =>
              c.name.toUpperCase().includes(nombre.slice(0, 3)),
            );
            return match ? { ...p, criticalityId: String(match.id) } : p;
          }),
        );
      })
      .catch(() => {});
  }, []);

  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);

  // Modo "línea": el tipo elegido es conducción/aducción → N puntos.
  const esLinea = TIPO_LINEA.includes(mapTipo(tipoLabel));
  const minPuntos = esLinea ? 2 : 1;

  // Derivados: cada punto con lat/lon y validez UTM (memo para el mapa).
  const puntosGeo: PuntoConLatLon[] = useMemo(() => {
    return puntos.map((p) => {
      const e = parseFloat(p.east);
      const n = parseFloat(p.north);
      const valido =
        !isNaN(e) && !isNaN(n) && e >= 100000 && e <= 900000 && n > 0 && n <= 10000000;
      let lat = 0;
      let lon = 0;
      if (valido) {
        try {
          const r = utmToLatLon(e, n, ZONA_UTM_DEFAULT, ZONA_LETRA_DEFAULT);
          lat = Math.round(r.latitude * 1e6) / 1e6;
          lon = Math.round(r.longitude * 1e6) / 1e6;
        } catch {
          // fuera de rango, deja 0,0
        }
      }
      return { ...p, lat, lon, valido };
    });
  }, [puntos]);

  function actualizarPunto(idx: number, cambios: Partial<Punto>) {
    setPuntos((prev) => prev.map((p, i) => (i === idx ? { ...p, ...cambios } : p)));
  }

  function agregarPunto() {
    setPuntos((prev) => [...prev, { east: '', north: '', criticalityId: '' }]);
  }

  function quitarPunto(idx: number) {
    setPuntos((prev) => prev.filter((_, i) => i !== idx));
  }

  const MAX = 300;
  const especificacionTruncada = especificacion.slice(0, MAX);

  async function handleGuardar() {
    setErrorGuardar(null);
    if (!tipoId || !distritoUbigeo || !codigo || !nombre) {
      setErrorGuardar('Complete los campos obligatorios: tipo, código, nombre y distrito.');
      return;
    }

    // Validar todas las coordenadas UTM ingresadas.
    if (puntos.length < minPuntos) {
      setErrorGuardar(
        esLinea
          ? `Las líneas de conducción/aducción deben tener al menos ${minPuntos} puntos.`
          : 'Debe ingresar las coordenadas UTM del componente.',
      );
      return;
    }
    const invalidos = puntosGeo.filter((p) => !p.valido);
    if (invalidos.length > 0) {
      setErrorGuardar(
        `${invalidos.length} punto(s) con coordenadas UTM inválidas. Ingrese Este entre 100000 y 900000 y Norte mayor a 0.`,
      );
      return;
    }

    setGuardando(true);
    try {
      // Contrato backend: coords[] embebido en una sola transaccion.
      //   POST   /components/         → crea componente + coords en lote
      //   PATCH  /components/{id}/    → reemplaza el conjunto de coords por
      //                               el array enviado (los previos se borran)
      const body = {
        code: codigo.padStart(4, '0'),
        name: nombre,
        specification: especificacion,
        district: distritoUbigeo,
        type: Number(tipoId),
        operational_status: estadoOperacionalCode || null,
        physical_status: estadoFisicoCode || null,
        coords: puntos.map((p) => ({
          criticality: Number(p.criticalityId) || 1,
          easting: parseFloat(p.east),
          northing: parseFloat(p.north),
          srid_origin: 18,
        })),
      };

      if (initial?.id) {
        await apiComponentes.updateComponente(Number(initial.id), body);
      } else {
        await apiComponentes.createComponente(body);
      }

      navigate('/componentes/gestion');
    } catch (err: unknown) {
      setErrorGuardar(extraerErrorGuardar(err));
    } finally {
      setGuardando(false);
    }
  }

  async function handleEliminar() {
    if (!initial?.id) return;
    if (!confirm('¿Está seguro de eliminar este componente? Esta acción no se puede deshacer.')) return;
    setGuardando(true);
    setErrorGuardar(null);
    try {
      await apiComponentes.deleteComponente(Number(initial.id));
      navigate('/componentes/gestion');
    } catch (err: unknown) {
      setErrorGuardar(extraerErrorGuardar(err, 'Error al eliminar el componente.'));
    } finally {
      setGuardando(false);
    }
  }

  function extraerErrorGuardar(err: unknown, fallback = 'Error al guardar el componente.'): string {
    const e = err as { response?: { data?: Record<string, unknown> } };
    const data = e?.response?.data;
    if (data && typeof data === 'object') {
      const parts: string[] = [];
      for (const [k, v] of Object.entries(data)) {
        if (Array.isArray(v)) parts.push(`${k}: ${(v as unknown[]).join('; ')}`);
        else if (typeof v === 'string') parts.push(`${k}: ${v}`);
        else if (typeof v === 'object' && v !== null) parts.push(`${k}: ${JSON.stringify(v)}`);
      }
      if (parts.length) return parts.join(' · ');
      const detail = (data as { detail?: string }).detail;
      if (detail) return detail;
    }
    return fallback;
  }

  function handleCancelar() {
    navigate('/componentes/gestion');
  }

  return (
    <div className="h-full flex flex-col">
    <div className="h-full overflow-y-auto p-5 flex flex-col items-start gap-5">
      {/* ── Cuerpo: 40% izquierda (datos) + 60% derecha (mapa+vistaprevia) ── */}
      <div className="self-stretch flex justify-center items-stretch gap-6">
        {/* Tarjeta izquierda — Datos del componente (columna comprimida) */}
        <div className="w-[520px] p-5 rounded-2xl border border-input-stroke-main flex flex-col gap-4 bg-background-main">
          <h2 className="text-text-primary text-base font-bold font-sans leading-6">
            Datos del componente
          </h2>

          {/* Tipo de componente + Icono preview */}
          <div className="flex gap-4">
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-text-primary text-xs font-medium font-sans">
                Tipo de Componente
              </label>
              <SelectInput
                value={tipoId}
                onChange={(v) => {
                  setTipoId(v);
                  const opt = tiposOptions.find((t) => t.value === v);
                  setTipoLabel(opt?.label ?? '');
                }}
                options={tiposOptions}
                placeholder="Seleccionar tipo de componente"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-text-primary text-xs font-medium font-sans">Ícono</label>
              <div className="size-14 py-3 rounded-lg border border-button-stroke grid place-items-center bg-background-main">
                <img
                  src={ICON_URL_BY_TIPO[mapTipo(tipoLabel)] ?? CaptacionIconUrl}
                  alt=""
                  className="w-9 h-9"
                />
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
              className="w-full bg-background-main rounded-lg outline outline-1 outline-offset-[-1px] outline-button-stroke px-3 py-2.5 text-text-primary text-sm font-sans focus:outline-2 focus:outline-primary-main"
            />
          </Field>

          {/* Nombre */}
          <Field label="Nombre">
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Captación Río Pichanaqui"
              className="w-full bg-background-main rounded-lg outline outline-1 outline-offset-[-1px] outline-button-stroke px-3 py-2.5 text-text-primary text-sm font-sans focus:outline-2 focus:outline-primary-main"
            />
          </Field>

          {/* Distrito (Unidad Operativa) */}
          <Field label="Unidad Operativa (Distrito)">
            <FilterableSelect
              value={distritoUbigeo}
              onChange={setDistritoUbigeo}
              options={distritosOptions.map((d) => ({ value: d.ubigeo, label: d.name }))}
              placeholder="Buscar distrito…"
              emptyLabel="— Seleccionar distrito —"
              dropdownMinWidth="min-w-[480px]"
            />
          </Field>

          {/* Estado operacional + Físico */}
          <div className="flex gap-4">
            <Field label="Estado Operacional" inline>
              <SelectInput
                value={estadoOperacionalCode}
                onChange={setEstadoOperacionalCode}
                options={estadosOpOptions}
                placeholder="Seleccionar estado"
              />
            </Field>
            <Field label="Estado Físico" inline>
              <SelectInput
                value={estadoFisicoCode}
                onChange={setEstadoFisicoCode}
                options={estadosFisOptions}
                placeholder="Seleccionar estado"
              />
            </Field>
          </div>

          {/* Especificación */}
          <Field label="Especificación (descripción - observaciones)">
            <textarea
              value={especificacionTruncada}
              onChange={(e) => setEspecificacion(e.target.value.slice(0, MAX))}
              placeholder="Ingrese una descripción u observaciones del componente..."
              className="w-full bg-background-main rounded-lg outline outline-1 outline-offset-[-1px] outline-button-stroke px-3 pt-2.5 pb-2.5 text-text-primary text-sm font-sans resize-none min-h-20 focus:outline-2 focus:outline-primary-main"
            />
            <span className="self-end text-text-secondary text-xs font-sans">
              {especificacionTruncada.length}/{MAX}
            </span>
          </Field>

          {/* Coordenadas UTM — tabla compacta (una fila por vértice) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-text-primary text-sm font-medium font-sans">
                  {esLinea ? 'Vértices de la línea (UTM)' : 'Coordenadas UTM'}
                </span>
                {esLinea && (
                  <span className="px-2 py-0.5 rounded-full bg-primary-states-hover-main/30 text-text-secondary text-xs font-sans">
                    {puntos.length} · mínimo {minPuntos}
                  </span>
                )}
              </div>
              {esLinea && (
                <button
                  type="button"
                  onClick={agregarPunto}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary-main/10 text-primary-main text-xs font-medium font-sans hover:bg-primary-main/20 transition-colors"
                >
                  <Plus className="size-3.5" strokeWidth={2} aria-hidden="true" />
                  Agregar vértice
                </button>
              )}
            </div>
            <span className="text-text-secondary text-xs font-sans">
              Ingrese las coordenadas UTM y se transformarán automáticamente a Lat/Lon.
              {esLinea && ' Cada vértice del tramo lleva su propia criticidad.'}
            </span>

            {/* Tabla compacta de vértices (header navy + scroll vertical) */}
            <div className="rounded-lg border border-input-stroke-main overflow-hidden flex flex-col">
              {/* Header navy sticky */}
              <div className="inline-flex items-stretch bg-primary-main">
                {esLinea && (
                  <div className="w-10 h-8 px-2 py-1.5 inline-flex items-center">
                    <span className="text-text-invert-primary text-xs font-bold font-sans">#</span>
                  </div>
                )}
                <div className="w-32 h-8 px-2 py-1.5 inline-flex items-center">
                  <span className="text-text-invert-primary text-xs font-bold font-sans uppercase tracking-wide">Este</span>
                </div>
                <div className="w-32 h-8 px-2 py-1.5 inline-flex items-center">
                  <span className="text-text-invert-primary text-xs font-bold font-sans uppercase tracking-wide">Norte</span>
                </div>
                <div className="w-36 h-8 px-2 py-1.5 inline-flex items-center">
                  <span className="text-text-invert-primary text-xs font-bold font-sans uppercase tracking-wide">Criticidad</span>
                </div>
                <div className="w-28 h-8 px-2 py-1.5 inline-flex items-center">
                  <span className="text-text-invert-primary text-xs font-bold font-sans uppercase tracking-wide">Lat</span>
                </div>
                <div className="w-28 h-8 px-2 py-1.5 inline-flex items-center">
                  <span className="text-text-invert-primary text-xs font-bold font-sans uppercase tracking-wide">Lon</span>
                </div>
                {esLinea && <div className="w-10 h-8 px-2 py-1.5 inline-flex items-center" />}
              </div>

              {/* Filas (scroll vertical interno si hay muchos vértices) */}
              <div className={cn('bg-background-main', esLinea && puntos.length > 6 ? 'max-h-72 overflow-y-auto' : '')}>
                {puntos.map((p, idx) => {
                  const geo = puntosGeo[idx];
                  const puedeQuitar = esLinea && puntos.length > minPuntos;
                  return (
                    <div
                      key={p.id ?? `new-${idx}`}
                      className="inline-flex items-stretch border-b border-input-stroke-main last:border-b-0 hover:bg-primary-states-hover-main/10 transition-colors"
                    >
                      {esLinea && (
                        <div className="w-10 h-9 px-2 py-1.5 inline-flex items-center justify-center">
                          <span className="size-5 inline-flex items-center justify-center rounded-full bg-primary-main text-text-invert-primary text-xs font-bold">
                            {idx + 1}
                          </span>
                        </div>
                      )}
                      <div className="w-32 h-9 px-1.5 py-1 inline-flex items-center">
                        <input
                          type="number"
                          value={p.east}
                          onChange={(e) => actualizarPunto(idx, { east: e.target.value })}
                          placeholder="463529.00"
                          className="w-full bg-background-main rounded-md outline outline-1 outline-offset-[-1px] outline-button-stroke px-2 py-1 text-text-primary text-sm font-mono tabular-nums font-sans focus:outline-2 focus:outline-primary-main"
                        />
                      </div>
                      <div className="w-32 h-9 px-1.5 py-1 inline-flex items-center">
                        <input
                          type="number"
                          value={p.north}
                          onChange={(e) => actualizarPunto(idx, { north: e.target.value })}
                          placeholder="8777285.00"
                          className="w-full bg-background-main rounded-md outline outline-1 outline-offset-[-1px] outline-button-stroke px-2 py-1 text-text-primary text-sm font-mono tabular-nums font-sans focus:outline-2 focus:outline-primary-main"
                        />
                      </div>
                      <div className="w-36 h-9 px-1.5 py-1 inline-flex items-center">
                        <SelectInput
                          value={p.criticalityId}
                          onChange={(v) => actualizarPunto(idx, { criticalityId: v })}
                          options={criticidadesOptions}
                          placeholder="—"
                          compact
                        />
                      </div>
                      <div className="w-28 h-9 px-2 py-1 inline-flex items-center">
                        <span className="text-text-secondary text-xs font-mono tabular-nums truncate">
                          {geo?.valido ? geo.lat.toFixed(6) : '—'}
                        </span>
                      </div>
                      <div className="w-28 h-9 px-2 py-1 inline-flex items-center">
                        <span className="text-text-secondary text-xs font-mono tabular-nums truncate">
                          {geo?.valido ? geo.lon.toFixed(6) : '—'}
                        </span>
                      </div>
                      {esLinea && (
                        <div className="w-10 h-9 px-2 py-1.5 inline-flex items-center justify-center">
                          {puedeQuitar && (
                            <button
                              type="button"
                              onClick={() => quitarPunto(idx)}
                              className="p-1 rounded-md text-secondary-main hover:bg-secondary-main/10 transition-colors"
                              aria-label="Quitar vértice"
                            >
                              <Trash2 className="size-3.5" strokeWidth={2} aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Tarjeta derecha — Mapa referencial + vista previa */}
        <div className="flex-1 flex flex-col gap-5">
          <MapaReferencial
            puntos={puntosGeo}
            esLinea={esLinea}
            iconUrl={ICON_URL_BY_TIPO[mapTipo(tipoLabel)] ?? CaptacionIconUrl}
            excludeId={initial?.id}
          />
          <VistaPrevia
            tipo={tipoLabel}
            puntos={puntosGeo}
            esLinea={esLinea}
            criticidadesOptions={criticidadesOptions}
            unidad={distritosOptions.find((d) => d.ubigeo === distritoUbigeo)?.name ?? ''}
            estadoOperacional={estadosOpOptions.find((o) => o.value === estadoOperacionalCode)?.label ?? ''}
            estadoFisico={estadosFisOptions.find((f) => f.value === estadoFisicoCode)?.label ?? ''}
          />
        </div>
      </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-8 py-5 border-t border-button-stroke bg-background-main flex flex-col items-end gap-2 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
        {errorGuardar && (
          <p className="text-red-600 text-sm font-sans">{errorGuardar}</p>
        )}
        <div className="flex justify-end items-center gap-3 w-full">
          {initial?.id && (
            <button
              type="button"
              onClick={handleEliminar}
              disabled={guardando}
              className="px-6 py-2.5 rounded-xl bg-secondary-main text-white text-sm font-medium font-sans
                         hover:bg-secondary-hover transition-colors
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary-main focus-visible:ring-offset-2
                         disabled:opacity-60 disabled:cursor-not-allowed mr-auto"
>
               {guardando ? 'Eliminando…' : 'Eliminar'}
             </button>
          )}
          <button
            type="button"
            onClick={handleCancelar}
            disabled={guardando}
            className="px-6 py-2.5 rounded-xl outline outline-1 outline-offset-[-1px] outline-button-stroke text-text-primary text-sm font-medium font-sans hover:bg-primary-states-hover-main/30 transition-colors
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main focus-visible:ring-offset-2
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleGuardar}
            disabled={guardando}
            className="px-6 py-2.5 rounded-xl bg-primary-main text-text-invert-primary text-sm font-medium font-sans
                       inline-flex justify-start items-center gap-2
                       hover:bg-primary-light transition-colors
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main focus-visible:ring-offset-2
                       disabled:opacity-60 disabled:cursor-not-allowed"
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
            {guardando ? 'Guardando…' : initial?.id ? 'Guardar Cambios' : 'Guardar Componente'}
          </button>
        </div>
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

function SelectInput({
  value,
  onChange,
  options,
  placeholder,
  compact = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  /** Si true, reduce paddings/radios para uso dentro de tablas compactas. */
  compact?: boolean;
}) {
  const showPlaceholder = !value;
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          compact
            ? 'w-full px-2 py-1 pr-7 rounded-md text-xs'
            : 'w-full px-4 py-2.5 pr-10 rounded-xl text-sm',
          'outline outline-1 outline-offset-[-1px] outline-button-stroke appearance-none',
          'font-sans bg-background-main',
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
        className={cn(
          'absolute top-1/2 -translate-y-1/2 size-4 text-icon-main pointer-events-none',
          compact ? 'right-2' : 'right-3',
        )}
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
function MapaReferencial({
  puntos,
  esLinea,
  iconUrl,
  excludeId,
}: {
  puntos: PuntoConLatLon[];
  esLinea: boolean;
  iconUrl: string;
  excludeId?: string;
}) {
  const validos = puntos.filter((p) => p.valido);
  // Centro: primero válido, o default Pichanaqui.
  const primero = validos[0];
  const lat = primero?.lat ?? 0;
  const lon = primero?.lon ?? 0;
  return (
    <div className="flex-1 min-h-[400px] p-5 rounded-2xl border border-input-stroke-main flex flex-col gap-3 bg-background-main relative isolate">
      <div className="flex items-center gap-2">
        <h3 className="text-text-primary text-base font-bold font-sans">
          {esLinea ? 'Recorrido de la línea' : 'Ubicación del componente'}
        </h3>
        <span className="px-2 py-0.5 bg-primary-states-hover-main/30 rounded-full text-text-secondary text-xs font-medium font-sans">
          Vista referencial
        </span>
      </div>
      <MiniMapa
        lat={lat}
        lon={lon}
        puntos={validos}
        esLinea={esLinea}
        iconUrl={iconUrl}
        excludeId={excludeId}
      />
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
  puntos,
  esLinea,
  criticidadesOptions,
  unidad,
  estadoOperacional,
  estadoFisico,
}: {
  tipo: string;
  puntos: PuntoConLatLon[];
  esLinea: boolean;
  criticidadesOptions: OpcionSelect[];
  unidad: string;
  estadoOperacional: string;
  estadoFisico: string;
}) {
  const primero = puntos[0];
  const lat = primero?.lat ?? 0;
  const lon = primero?.lon ?? 0;
  const utmE = primero?.east ?? '';
  const utmN = primero?.north ?? '';
  const criticidadNombre =
    criticidadesOptions.find((c) => c.value === primero?.criticalityId)?.label ?? '';

  return (
    <div className="self-stretch p-5 rounded-2xl border border-input-stroke-main flex flex-col gap-3 bg-background-main">
      <h3 className="text-text-primary text-base font-bold font-sans">
        Vista previa del componente
      </h3>
      <div className="flex flex-col gap-2.5">
        <Fila label="Tipo:" value={tipo} />
        {!esLinea ? (
          <>
            <Fila
              label="Ubicación:"
              value={lat === 0 && lon === 0
                ? '—'
                : `Lat: ${lat.toFixed(6)}, Long: ${lon.toFixed(6)}`}
            />
            <Fila label="UTM:" value={`E: ${utmE}, N: ${utmN}`} />
          </>
        ) : (
          <Fila
            label="Vértices:"
            value={`${puntos.length} punto${puntos.length === 1 ? '' : 's'}`}
          />
        )}
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
        {!esLinea && (
          <Fila
            label="Criticidad:"
            value={criticidadNombre}
            badgeColor={colorCriticidad(criticidadNombre)}
          />
        )}
      </div>
    </div>
  );
}

function colorCriticidad(nombre: string): string {
  const n = nombre.toUpperCase();
  if (n.includes('ALT')) {
    return 'bg-secondary-hover rounded-full px-3 py-[3px] text-xs font-bold font-sans text-secondary-main';
  }
  if (n.includes('MED')) {
    return 'bg-warning-states-hover rounded-full px-3 py-[3px] text-xs font-bold font-sans text-warning-dark';
  }
  return 'bg-success-states-hover rounded-full px-3 py-[3px] text-xs font-bold font-sans text-success-dark';
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
  puntos,
  esLinea,
  iconUrl,
  excludeId,
}: {
  lat: number;
  lon: number;
  puntos: PuntoConLatLon[];
  esLinea: boolean;
  iconUrl: string;
  excludeId?: string;
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
  const PolylineAny = Polyline as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Lany = L as any;

  // Icono destacado del componente en edición (56x56 + anilloamarillo,
  // idéntico al marker "selected" de ComponentLayer para que ambos mapas
  // se vean iguales y no haya desplazamiento visual entre ellos).
  const icon = Lany.divIcon({
    html: `<div style="
      color: var(--eps-primary-main);
      display:grid;place-items:center;
      width:56px;height:56px;
      background: var(--eps-background-selected);
      border-radius: 50%;
      padding: 12px;
      filter: drop-shadow(0 6px 6px rgba(0,0,0,0.35));
    "><img src="${iconUrl}" style="width:60px;height:60px;" alt=""/></div>`,
    className: 'mini-marker-selected',
    iconSize: [56, 56],
    iconAnchor: [28, 28],
    tooltipAnchor: [0, -28],
  });

  // Icono de vértice (más chico, numerado) para líneas.
  const iconVertice = (idx: number) =>
    Lany.divIcon({
      html: `<div style="
        color: white;
        display:grid;place-items:center;
        width:24px;height:24px;
        background: var(--eps-primary-main);
        border-radius: 50%;
        font-size:11px;font-weight:bold;font-family:sans-serif;
        filter: drop-shadow(0 2px 2px rgba(0,0,0,0.35));
      ">${idx}</div>`,
      className: 'mini-vertice',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

  // Centro inicial: si hay coordenadas válidas, usa esas; si no, Pichanaqui.
  const center: [number, number] =
    lat !== 0 && lon !== 0 ? [lat, lon] : [-11.019, -75.297];

  // `key` cambia si `center` cambia meaningfulmente, así react-leaflet
  // remonta el MapContainer con el nuevo `center`. Esto permite que el
  // `AutoPan` (que usa `useMap`) tenga tiempo de ajustar el centro sin
  // conflictos con el `center` inicial.
  const mapKey = `mini-${lat.toFixed(4)}-${lon.toFixed(4)}-${puntos.length}`;

  // Polyline path: lista de [lat,lon] por cada punto valido.
  const path: [number, number][] = puntos.map((p) => [p.lat, p.lon]);

  return (
    <div className="flex-1 rounded-xl overflow-hidden border border-input-stroke-main min-h-[360px]">
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
        <ComponentLayer excludeId={excludeId} />
        {/* AutoPan ajusta el centro cuando cambian lat/lon. */}
        <AutoPan lat={lat} lon={lon} />
        {esLinea && path.length >= 2 && (
          <PolylineAny
            positions={path}
            pathOptions={{ color: '#1f6feb', weight: 4, opacity: 0.8 }}
          />
        )}
        {esLinea
          ? puntos.map((p, i) => (
              <MarkerAny
                key={p.id ?? `new-${i}`}
                position={[p.lat, p.lon]}
                icon={iconVertice(i + 1)}
              />
            ))
          : <MarkerAny position={center} icon={icon} />}
      </MapContainerAny>
    </div>
  );
}
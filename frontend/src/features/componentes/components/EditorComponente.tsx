import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, MapPin, Plus, Trash2 } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap, useMapEvents } from 'react-leaflet';
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
import { apiOrganization } from '@/services/apiOrganization';
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
  const [estadosOpOptions, setEstadosOpOptions] = useState<OpcionSelect[]>([]);
  const [estadosFisOptions, setEstadosFisOptions] = useState<OpcionSelect[]>([]);
  const [criticidadesOptions, setCriticidadesOptions] = useState<OpcionSelect[]>([]);
  /** Unidades operativas: branches activas con su district.ubigeo + nombre. */
  const [branchesOptions, setBranchesOptions] = useState<
    Array<{ ubigeo: string; name: string }>
  >([]);

  useEffect(() => {
    Promise.all([
      apiComponentes.listTipos(),
      apiComponentes.listEstadosOperacionales(),
      apiComponentes.listEstadosFisicos(),
      apiComponentes.listCriticidades(),
      apiOrganization.listBranches({ status: true }),
    ])
      .then(([tipos, ops, fis, crits, branches]) => {
        setTiposOptions(tipos.map((t) => ({ value: String(t.id), label: t.name })));
        setEstadosOpOptions(ops.map((o) => ({ value: o.code, label: o.name })));
        setEstadosFisOptions(fis.map((f) => ({ value: f.code, label: f.name })));
        setCriticidadesOptions(crits.map((c) => ({ value: String(c.id), label: c.name })));

        // Filtrar branches con district válido y mapear a {ubigeo, name}.
        const opts = branches
          .map((b) => {
            const d = typeof b.district === 'string' ? null : b.district;
            if (!d || !d.ubigeo || !d.name) return null;
            return { ubigeo: d.ubigeo, name: b.name }; // label = branch name
          })
          .filter((x): x is { ubigeo: string; name: string } => x !== null)
          .sort((a, b) => a.name.localeCompare(b.name, 'es'));
        setBranchesOptions(opts);

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
  /**
   * Modo captura del mapa: cuando está ON, los clics en el mapa
   * capturan un punto (modo puntual = reemplaza el único punto;
   * modo línea = añade un vértice al final del trazado). Default OFF
   * para evitar capturas accidentales. Los marcadores son
   * arrastrables en cualquier modo (corrige posición a mano).
   */
  const [captureMode, setCaptureMode] = useState(false);

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

  /**
   * Captura un punto del mapa (vía `useMapEvents({ click })` cuando el
   * modo captura está activo). Pasa al callback del padre (la página)
   * las coords en WGS84, y aquí en el componente convertimos a UTM y
   * actualizamos `puntos`:
   *   - Modo puntual: reemplaza `puntos[0]`.
   *   - Modo línea: añade un nuevo vértice al final del trazado.
   */
  function handleMapCapture(lat: number, lng: number) {
    const utm = latLonToUtm(lat, lng, ZONA_UTM_DEFAULT);
    const east = String(utm.easting);
    const north = String(utm.northing);
    if (esLinea) {
      // Nuevo vértice. Criticidad: tomamos la del primer catálogo (si
      // cargó) o cadena vacía. El usuario puede ajustarla después en
      // la tabla UTM.
      const defaultCrit = criticidadesOptions[0]?.value ?? '';
      setPuntos((prev) => [...prev, { east, north, criticalityId: defaultCrit }]);
    } else {
      setPuntos((prev) => {
        if (prev.length === 0) return [{ east, north, criticalityId: '' }];
        // Mantener la criticidad existente si había (no borrarla).
        const critId = prev[0].criticalityId;
        return [{ east, north, criticalityId: critId }];
      });
      // Tras la captura puntual se desactiva el modo captura (ya hay).
      setCaptureMode(false);
    }
  }

  /**
   * Drag-end de un marcador arrastrable. El usuario soltó el marcador
   * en una nueva posición; actualizamos ese índice con las nuevas coords
   * (convertidas a UTM). Modo línea mueve el vértice `idx`; modo puntual
   * `idx=0` repriza el único punto.
   */
  function handleMarkerDrag(idx: number, lat: number, lng: number) {
    const utm = latLonToUtm(lat, lng, ZONA_UTM_DEFAULT);
    actualizarPunto(idx, {
      east: String(utm.easting),
      north: String(utm.northing),
    });
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
      {/* ── Cuerpo: mapa a la izquierda (flex-1) + drawer datos a la derecha
           fijo (w-[420px]). Sin tarjetas externas: el mapa es la vista
           previa y el drawer contiene todo el formulario en un scroll
           vertical único. Esto prepara el terreno para "click en el mapa
           = agregar vértice" (futuro) y elimina la duplicación con la
           antigua tarjeta Vista Previa. */}
      <div className="flex-1 flex min-h-0">
        {/* ── Mapa (izquierda, ocupa todo el ancho restante) ───────────── */}
        <div className="flex-1 min-w-0 flex flex-col z-0 relative">
          {/* Botón flotante para activar/desactivar modo captura.
              Default OFF. Cuando está ON, los clics en el mapa capturan
              un punto (modo puntual) o un vértice (modo línea). Viven
              sobre el mapa, esquina superior derecha. */}
          <button
            type="button"
            onClick={() => setCaptureMode((v) => !v)}
            aria-pressed={captureMode}
            aria-label={
              esLinea
                ? captureMode
                  ? 'Finalizar captura de vértices en el mapa'
                  : 'Capturar vértices en el mapa'
                : captureMode
                  ? 'Finalizar captura del punto en el mapa'
                  : 'Capturar punto en el mapa'
            }
            title={
              esLinea
                ? captureMode
                  ? 'Finalizar captura de vértices'
                  : 'Capturar vértices en el mapa'
                : captureMode
                  ? 'Finalizar captura'
                  : 'Capturar punto en el mapa'
            }
            className={cn(
              'absolute top-3 right-3 z-[1000] inline-flex items-center gap-1.5',
              'px-3 py-2 rounded-lg shadow-md text-sm font-bold font-sans transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main focus-visible:ring-offset-2',
              captureMode
                ? 'bg-primary-main text-text-invert-primary hover:bg-primary-light'
                : 'bg-background-main text-primary-main outline outline-1 outline-offset-[-1px] outline-primary-main hover:bg-primary-states-hover-main/20',
            )}
          >
            <MapPin className="size-4" strokeWidth={2} aria-hidden="true" />
            {captureMode
              ? (esLinea ? 'Finalizar' : 'Finalizar')
              : (esLinea ? 'Vértices' : 'Capturar')}
          </button>

          <MiniMapa
            lat={puntosGeo.find((p) => p.valido)?.lat ?? 0}
            lon={puntosGeo.find((p) => p.valido)?.lon ?? 0}
            puntos={puntosGeo.filter((p) => p.valido)}
            esLinea={esLinea}
            iconUrl={ICON_URL_BY_TIPO[mapTipo(tipoLabel)] ?? CaptacionIconUrl}
            excludeId={initial?.id}
            fullSize
            captureMode={captureMode}
            onCapture={handleMapCapture}
            onMarkerDrag={handleMarkerDrag}
            onRemoveVertex={(idx) => {
              if (esLinea && puntos.length > minPuntos) quitarPunto(idx);
            }}
            minPuntos={minPuntos}
          />
        </div>

        {/* ── Drawer derecho con todos los datos (scroll vertical único) ── */}
        <aside className="w-[420px] shrink-0 border-l border-input-stroke-main bg-background-main flex flex-col">
          <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-4">
            <h2 className="text-text-primary text-base font-bold font-sans leading-6">
              {initial?.id ? `Editar componente #${initial.codigo}` : 'Nuevo componente'}
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
                options={branchesOptions.map((d) => ({ value: d.ubigeo, label: d.name }))}
                placeholder="Buscar distrito…"
                emptyLabel="— Seleccionar distrito —"
                dropdownMinWidth="min-w-[380px]"
              />
            </Field>

            {/* Estado operacional + Físico */}
            <div className="flex gap-3">
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

              {/* Tabla UTM compacta — ya construida abajo (esLinea ? linea : punto) */}
              {esLinea ? (
              /* Tabla de vértices (LÍNEA) — scroll horizontal compartido
                 (header + filas) via `overflow-x-auto` en el wrapper.
                 Header sticky vertical (se mantiene al scrollear y).
                 Columnas con width MINIMO via `min-w-*` para que cuando
                 haya menos ancho aparezca scroll horizontal en lugar de
                 comprimirse. */
              <div className="rounded-lg border border-input-stroke-main overflow-x-auto">
                <div className="min-w-[44rem]">
                  {/* Header navy — sticky top */}
                  <div className="grid grid-cols-[2.5rem_8rem_8rem_9rem_7rem_7rem_2.5rem]
                                  bg-primary-main sticky top-0 z-10">
                    <HeaderCell>#</HeaderCell>
                    <HeaderCell>Este</HeaderCell>
                    <HeaderCell>Norte</HeaderCell>
                    <HeaderCell>Criticidad</HeaderCell>
                    <HeaderCell>Lat</HeaderCell>
                    <HeaderCell>Lon</HeaderCell>
                    <div className="h-8" />
                  </div>
                  <div
                    className={cn(
                      'bg-background-main overflow-y-auto',
                      puntos.length > 6 ? 'max-h-72' : '',
                      '[scrollbar-gutter:stable]',
                    )}
                  >
                    {puntos.map((p, idx) => {
                      const geo = puntosGeo[idx];
                      const puedeQuitar = puntos.length > minPuntos;
                      return (
                        <div
                          key={p.id ?? `new-${idx}`}
                          className="grid grid-cols-[2.5rem_8rem_8rem_9rem_7rem_7rem_2.5rem]
                                     items-center border-b border-input-stroke-main last:border-b-0
                                     hover:bg-primary-states-hover-main/10 transition-colors"
                        >
                          <div className="h-9 flex items-center justify-center">
                            <span className="size-5 inline-flex items-center justify-center rounded-full bg-primary-main text-text-invert-primary text-xs font-bold">
                              {idx + 1}
                            </span>
                          </div>
                          <CoordCellInput
                            value={p.east}
                            onChange={(v) => actualizarPunto(idx, { east: v })}
                            placeholder="463529.00"
                          />
                          <CoordCellInput
                            value={p.north}
                            onChange={(v) => actualizarPunto(idx, { north: v })}
                            placeholder="8777285.00"
                          />
                          <div className="px-1.5 py-1">
                            <SelectInput
                              value={p.criticalityId}
                              onChange={(v) => actualizarPunto(idx, { criticalityId: v })}
                              options={criticidadesOptions}
                              placeholder="—"
                              compact
                            />
                          </div>
                          <CoordCellRead value={geo?.valido ? geo.lat.toFixed(6) : '—'} />
                          <CoordCellRead value={geo?.valido ? geo.lon.toFixed(6) : '—'} />
                          <div className="h-9 flex items-center justify-center">
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
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* Modo PUNTO: misma estructura con scroll horizontal compartido. */
              <div className="rounded-lg border border-input-stroke-main overflow-x-auto">
                <div className="min-w-[36rem]">
                  <div className="grid grid-cols-[8rem_8rem_9rem_7rem_7rem]
                                  bg-primary-main sticky top-0 z-10">
                    <HeaderCell>Este</HeaderCell>
                    <HeaderCell>Norte</HeaderCell>
                    <HeaderCell>Criticidad</HeaderCell>
                    <HeaderCell>Lat</HeaderCell>
                    <HeaderCell>Lon</HeaderCell>
                  </div>
                  <div className="bg-background-main">
                    {puntos.map((p, idx) => {
                      const geo = puntosGeo[idx];
                      return (
                        <div
                          key={p.id ?? `new-${idx}`}
                          className="grid grid-cols-[8rem_8rem_9rem_7rem_7rem] items-center
                                     border-b border-input-stroke-main last:border-b-0"
                        >
                          <CoordCellInput
                            value={p.east}
                            onChange={(v) => actualizarPunto(idx, { east: v })}
                            placeholder="463529.00"
                          />
                          <CoordCellInput
                            value={p.north}
                            onChange={(v) => actualizarPunto(idx, { north: v })}
                            placeholder="8777285.00"
                          />
                          <div className="px-1.5 py-1">
                            <SelectInput
                              value={p.criticalityId}
                              onChange={(v) => actualizarPunto(idx, { criticalityId: v })}
                              options={criticidadesOptions}
                              placeholder="—"
                              compact
                            />
                          </div>
                          <CoordCellRead value={geo?.valido ? geo.lat.toFixed(6) : '—'} />
                          <CoordCellRead value={geo?.valido ? geo.lon.toFixed(6) : '—'} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>
        </aside>
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

/** Celda del header de la tabla de vértices (navy). */
function HeaderCell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-8 px-2 inline-flex items-center">
      <span className="text-text-invert-primary text-xs font-bold font-sans uppercase tracking-wide">
        {children}
      </span>
    </div>
  );
}

/** Celda cuerpo de la tabla de vértices con input numérico (UTM Este/Norte). */
function CoordCellInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="px-1.5 py-1">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-background-main rounded-md outline outline-1 outline-offset-[-1px] outline-button-stroke
                   px-2 py-1 text-text-primary text-sm font-mono tabular-nums font-sans
                   focus:outline-2 focus:outline-primary-main"
      />
    </div>
  );
}

/** Celda read-only de la tabla de vértices (Lat/Lon calculados). */
function CoordCellRead({ value }: { value: string }) {
  return (
    <div className="px-2 py-1 h-9 flex items-center">
      <span className="text-text-secondary text-xs font-mono tabular-nums truncate w-full">
        {value}
      </span>
    </div>
  );
}

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
 * CaptureController — componente helper que vive dentro del `<MapContainer>`
 * para escuchar clicks del mapa cuando `captureMode` está ON y disparar
 * `onCapture(lat, lng)`. También aplica estilo `crosshair` al cursor del
 * contenedor del mapa cuando hay captura activa (estilo QGIS/Felt).
 *
 * No renderiza nada; es un side-effect puro.
 */
function CaptureController({
  captureMode,
  onCapture,
}: {
  captureMode: boolean;
  onCapture: (lat: number, lng: number) => void;
}) {
  const map = useMap();
  // `as any`: react-leaflet@5 + @types/leaflet@1.9 no resuelve
  // correctamente las props de `useMapEvents` bajo TS6 moduleResolution
  // bundler. Mismo workaround que el resto del mapa (ver ComponentLayer).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const useMapEventsAny = useMapEvents as any;

  // Subscribirse a clicks del mapa. Los ignoramos cuando el modo captura
  // está OFF (sólo pan/zoom natural).
  useMapEventsAny({
    click: (e: { latlng: { lat: number; lng: number } }) => {
      if (!captureMode) return;
      onCapture(e.latlng.lat, e.latlng.lng);
    },
  });

  // Cursor crosshair en modo captura (estilo QGIS/Felt).
  useEffect(() => {
    const container = map.getContainer();
    if (captureMode) {
      container.style.cursor = 'crosshair';
    } else {
      container.style.cursor = '';
    }
    return () => {
      container.style.cursor = '';
    };
  }, [map, captureMode]);

  return null;
}

/**
 * MiniMapa — mapa Leaflet usado por el editor. En el layout actual vive
 * a pantalla completa a la izquierda del drawer de datos. Muestra el
 * componente en edición + todos los demás (vía `ComponentLayer`) para
 * que el usuario vea la relación con la red. Permite zoom/pan.
 *
 * `fullSize` rellena todo el espacio disponible. Si se pasa `false`,
 * usa `min-h-[360px]` (modo legacy).
 *
 * Modo captura (`captureMode`):
 *   - ON → clic en el mapa captura (punto: reemplaza; línea: añade
 *     vértice al final). El cursor se vuelve `crosshair`.
 *   - OFF → click en el mapa NO hace nada (sólo pan/zoom natural).
 *
 * Marcadores arrastrables (siempre, en cualquier modo):
 *   - En `dragend` actualizamos la posición del vértice correspondiente
 *     vía `onMarkerDrag(idx, lat, lng)`. No requiere modo captura —
 *     corregir posición es la edición más común.
 *
 * Popup "Eliminar vértice": en modo línea, click en un marcador abre un
 * popup con un botón para eliminarlo (respeta `minPuntos`).
 *
 * Nota: el antiguo `AutoPan` fue removido. Causaba loops con el dragging
 * (mover marcador → cambian coords → AutoPan re-centra → marcador
 * "vuelve"). El usuario centra el mapa a mano (scrollWheelZoom activo).
 */
function MiniMapa({
  lat,
  lon,
  puntos,
  esLinea,
  iconUrl,
  excludeId,
  fullSize = false,
  captureMode = false,
  onCapture,
  onMarkerDrag,
  onRemoveVertex,
  minPuntos,
}: {
  lat: number;
  lon: number;
  puntos: PuntoConLatLon[];
  esLinea: boolean;
  iconUrl: string;
  excludeId?: string;
  fullSize?: boolean;
  captureMode?: boolean;
  onCapture?: (lat: number, lng: number) => void;
  onMarkerDrag?: (idx: number, lat: number, lng: number) => void;
  onRemoveVertex?: (idx: number) => void;
  minPuntos?: number;
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
  const PopupAny = Popup as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Lany = L as any;

  // Icono destacado del componente en edición (56x56 + anillo amarillo,
  // idéntico al marker "selected" de ComponentLayer para que ambos mapas
  // se vean iguales y sin desplazamiento visual del punto lat/lng). La
  // imagen interna se mantiene SIEMPRE en 40px (ancho nativo del SVG);
  // el contenedor crece a 56px para alojar el anillo amarillo alrededor.
  // El padding fue removido (causaba desplazamiento porque la imagen era
  // 60×60 y sobresalía del contenedor).
  const icon = Lany.divIcon({
    html: `<div style="
      color: var(--eps-primary-main);
      display:grid;place-items:center;
      width:56px;height:56px;
      background: var(--eps-background-selected);
      border-radius: 50%;
      filter: drop-shadow(0 6px 6px rgba(0,0,0,0.35));
    "><img src="${iconUrl}" style="width:40px;height:40px;" alt=""/></div>`,
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
  // El AutoPan fue removido, así que nos basta con el `center` inicial.
  const center: [number, number] =
    lat !== 0 && lon !== 0 ? [lat, lon] : [-11.019, -75.297];

  // Polyline path: lista de [lat,lon] por cada punto válido.
  const path: [number, number][] = puntos.map((p) => [p.lat, p.lon]);

  return (
    <div
      className={cn(
        'flex-1 rounded-xl overflow-hidden border border-input-stroke-main',
        fullSize ? 'h-full min-h-0' : 'min-h-[360px]',
      )}
    >
      <MapContainerAny
        center={center}
        zoom={15}
        scrollWheelZoom
        zoomControl={false}
        minZoom={5}
        maxZoom={20}
        maxBounds={[[-18.5, -81.5], [0.5, -68.5]]}
        maxBoundsViscosity={0.7}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayerAny
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
          maxZoom={20}
          maxNativeZoom={16}
        />
        {/* Componentes del sistema (para ver la relación con los demás). */}
        <ComponentLayer excludeId={excludeId} />

        {/* Controlador de modo captura: escucha clicks cuando ON y
            aplica cursor crosshair. */}
        <CaptureController
          captureMode={captureMode}
          onCapture={(lat, lng) => onCapture?.(lat, lng)}
        />

        {/* Polyline del trazado en modo línea. */}
        {esLinea && path.length >= 2 && (
          <PolylineAny
            positions={path}
            pathOptions={{ color: '#1f6feb', weight: 4, opacity: 0.8 }}
          />
        )}

        {/* Marcadores arrastrables */}
        {esLinea
          ? puntos.map((p, i) => {
            // UTM del vértice derivado de su lat/lon (la principal del editor).
              let utmE = '';
              let utmN = '';
              try {
                const u = latLonToUtm(p.lat, p.lon, ZONA_UTM_DEFAULT);
                utmE = Math.round(u.easting).toLocaleString('es-PE');
                utmN = Math.round(u.northing).toLocaleString('es-PE');
              } catch {
                // fuera de rango, lo dejamos en —
              }
              return (
              <MarkerAny
                key={p.id ?? `new-${i}`}
                position={[p.lat, p.lon]}
                icon={iconVertice(i + 1)}
                draggable
                eventHandlers={{
                  dragend: (e: { target: { getLatLng: () => { lat: number; lng: number } } }) => {
                    const ll = e.target.getLatLng();
                    onMarkerDrag?.(i, ll.lat, ll.lng);
                  },
                }}
              >
                <PopupAny>
                  <div className="flex flex-col gap-1.5" style={{ fontFamily: 'sans-serif' }}>
                    <span style={{ fontWeight: 700, color: 'var(--eps-primary-main)' }}>
                      Vértice {i + 1}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--eps-text-secondary)' }}>
                      UTM Este: <strong style={{ color: 'var(--eps-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{utmE || '—'}</strong>
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--eps-text-secondary)' }}>
                      UTM Norte: <strong style={{ color: 'var(--eps-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{utmN || '—'}</strong>
                    </span>
                    {(puntos.length > (minPuntos ?? 1)) && (
                      <button
                        type="button"
                        onClick={() => onRemoveVertex?.(i)}
                        className="mt-1 px-2 py-1 rounded-md text-xs text-danger-main
                                   border border-danger-main hover:bg-danger-states-hover
                                   font-sans font-bold"
                      >
                        Eliminar vértice
                      </button>
                    )}
                  </div>
                </PopupAny>
              </MarkerAny>
              );
            })
          // Modo puntual: mostramos un marcador arrastrable SÓLO cuando
          // hay un punto válido definido. Si no, no se muestra marker
          // (el cursor crosshair guía al usuario a capturar).
          : puntos.length > 0
            ? puntos.map((p, i) => (
                <MarkerAny
                  key={p.id ?? `new-${i}`}
                  position={[p.lat, p.lon]}
                  icon={icon}
                  draggable
                  eventHandlers={{
                    dragend: (e: { target: { getLatLng: () => { lat: number; lng: number } } }) => {
                      const ll = e.target.getLatLng();
                      onMarkerDrag?.(i, ll.lat, ll.lng);
                    },
                  }}
                />
              ))
            : null}
      </MapContainerAny>
    </div>
  );
}

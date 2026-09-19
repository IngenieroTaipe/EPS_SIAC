import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { FilterableSelect } from '@/shared/components/FilterableSelect';
import { apiUmbrales, dedupeUmbrales, type UmbralFenomeno } from '@/services/apiUmbrales';
import { apiGFS } from '@/services/apiGFS';
import { apiPlaces } from '@/services/apiPlaces';
import type { GfsClusterFeatureCollection } from '@/features/mapa/types/gfs';
import { GFS_COLOR_MAP, GFS_LABEL } from '@/features/mapa/types/gfs';
import { thresholdNameToCategoria, valorEnRango } from '@/features/umbrales/types';
import { UmbralesTable } from './UmbralesTable';
import { EditorUmbral } from './EditorUmbral';

/**
 * GestionUmbrales — página de gestión de Umbrales de Fenómenos Naturales.
 *
 * Lógica (lazy loading total — nada se consulta hasta seleccionar):
 *
 *   1. El selector lista TODOS los distritos del país (endpoint ligero
 *      `/places/districts/light/`, sin geometrías ni paginación; el
 *      FilterableSelect filtra por nombre en memoria). NO hay
 *      pre-selección: al entrar no se consulta nada de umbrales.
 *   2. Al SELECCIONAR un distrito se cargan SOLO sus umbrales vía
 *      `apiUmbrales.listUmbrales({ district__ubigeo })` (caché 1h). Si el
 *      distrito no tiene umbrales, el panel derecho lo indica (y permite
 *      registrarlos — cualquier distrito, no sólo los de la EPS).
 *   3. Para el distrito seleccionado se muestran sus umbrales ordenados de
 *      menor a mayor rango.
 *   4. El máximo umbral registrado (max_intensity_mm_h de los clústeres cuyo
 *      `affected_ubigeos` incluye el distrito) se muestra en el panel; los
 *      clústeres GFS (ventana 18h) se cargan UNA vez al montar de fondo
 *      (caché 10 min) para que el panel se llene instantáneo al seleccionar.
 *      La fila del umbral cuyo rango [min,max) contiene ese valor se
 *      resalta en negrita / color de marca.
 *   5. Botón "Agregar umbral" abre el modal que hace POST al endpoint
 *      `/core_predictive/thresholds-natural-phenomenas/` (admite editar /
 *      eliminar un registro existente). El modal carga sus propios
 *      hermanos del combo al abrir (no recibe pool global).
 *
 * NOTA (para qué sirven los umbrales): el backend los usa al PROCESAR
 * cada corrida GFS para clasificar celdas/clústeres por distrito
 * (cluster_service._get_thresholds) y de esa clasificación heredan las
 * ALERTAS (highest_threshold). Un cambio de umbral se refleja en la
 * PRÓXIMA corrida (≤6h); las corridas ya clasificadas no se recalculan.
 * La descarga NOAA en sí NO depende de los umbrales.
 */
export function GestionUmbrales() {
  // Umbrales del distrito seleccionado (carga lazy, no global).
  const [umbrales, setUmbrales] = useState<UmbralFenomeno[]>([]);
  const [clusters, setClusters] = useState<GfsClusterFeatureCollection | null>(null);
  const [loadingUmbrales, setLoadingUmbrales] = useState(false);
  const [loadingClusters, setLoadingClusters] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Catálogo de TODOS los distritos (endpoint light). Se carga al montar;
  // los umbrales NO se consultan hasta que el usuario seleccione uno.
  const [distritos, setDistritos] = useState<Array<{ ubigeo: string; nombre: string }>>([]);
  const [distritosLoading, setDistritosLoading] = useState(true);

  const [selectedUbigeo, setSelectedUbigeo] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'editar' | 'agregar'>('agregar');
  const [editingCombo, setEditingCombo] = useState<{
    naturalPhenomenaId: number;
    variableId: number;
    districtUbigeo: string;
  } | null>(null);

  // 1. Cargar los umbrales SOLO del distrito seleccionado (lazy loading).
  //    El selector de distritos proviene de los branches del contexto
  //    (Unidad Operativa), así que no hace falta cargar todos los umbrales
  //    para saber qué distritos existen. Caché de 1h en apiUmbrales.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- secuencia de carga
       (reset/load true → fetch → loading false), patrón React canónico. */
    if (!selectedUbigeo) {
      setUmbrales([]);
      return;
    }
    setLoadingUmbrales(true);
    apiUmbrales
      .listUmbrales({ 'district__ubigeo': selectedUbigeo })
      .then((rows) => setUmbrales(rows))
      .catch(() => setError('No se pudieron cargar los umbrales del distrito.'))
      .finally(() => setLoadingUmbrales(false));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [selectedUbigeo]);

  // 2. Cargar clústeres GFS (ventana 18h) una sola vez al montar.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- secuencia de carga
       (loading true → fetch → loading false), patrón React canónico. */
    setLoadingClusters(true);
    apiGFS
      .getHistoricWindowClusters()
      .then((fc) => setClusters(fc))
      .catch(() => setClusters(null))
      .finally(() => setLoadingClusters(false));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // 3. Catálogo de TODOS los distritos del país (endpoint ligero
  //    `/places/districts/light/`, sin geometrías ni paginación). Una sola
  //    consulta al montar; el FilterableSelect filtra por nombre en
  //    memoria (diseñado para listas largas, ej. ~1800 distritos).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- secuencia de carga
       (loading true → fetch → loading false), patrón React canónico. */
    setDistritosLoading(true);
    apiPlaces
      .listDistrictsLight()
      .then((list) => {
        setDistritos(
          list
            .map((d) => ({ ubigeo: d.ubigeo, nombre: d.name }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
        );
      })
      .catch(() => setDistritos([]))
      .finally(() => setDistritosLoading(false));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // (Sin pre-selección automática: NADA se consulta hasta que el usuario
  //  elige un distrito — el efecto 1 carga los umbrales al seleccionar, y
  //  el panel de máximo umbral se llena de los clústeres ya cargados de
  //  fondo en el efecto 2. Así cualquier distrito del país —no sólo los
  //  de la EPS— puede gestionarse.)

  // 5. Máximo umbral registrado GFS para el distrito seleccionado.
  //    Sólo considera los clústeres cuyo `affected_ubigeos` incluye al
  //    distrito. Si la corrida GFS actual no genera lluvia sobre la zona,
  //    no hay nada que mostrar (comportamiento original).
  const maxInfo = useMemo<{ umbral: UmbralFenomeno | null; mmh: number | null }>(() => {
    if (!clusters || selectedUbigeo === null) return { umbral: null, mmh: null };
    let maxMmh: number | null = null;
    for (const f of clusters.features ?? []) {
      const ubgs = (f.properties.affected_ubigeos ?? []) as Array<string | null>;
      if (!ubgs.includes(selectedUbigeo)) continue;
      const v = f.properties.max_intensity_mm_h;
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      if (maxMmh === null || v > maxMmh) maxMmh = v;
    }
    if (maxMmh === null) return { umbral: null, mmh: null };
    const encontrado = umbrales.find((u) => valorEnRango(maxMmh, u)) ?? null;
    return { umbral: encontrado, mmh: maxMmh };
  }, [clusters, selectedUbigeo, umbrales]);

  const activoId = maxInfo.umbral?.id ?? null;

  function abrirCrear() {
    setEditingCombo(null);
    setModalMode('agregar');
    setModalOpen(true);
  }

  function abrirEditar(u: UmbralFenomeno) {
    // Fija el combo (np + var + distrito) a regenerar; el editor precarga
    // los cortes actuales y deshabilita los 3 selects.
    setEditingCombo({
      naturalPhenomenaId: u.natural_phenomena.id,
      variableId: u.variable.id,
      districtUbigeo: u.district.ubigeo,
    });
    setModalMode('editar');
    setModalOpen(true);
  }

  /**
   * Recibe la lista COMPLETA de filas resultantes del bulk (escalera nueva
   * del distrito + fenómeno + variable editado). Sustituye todas las filas
   * previas del mismo combo en `umbrales` (sólo del distrito seleccionado),
   * dejando el resto intacto.
   *
   * Dos guards de visualización:
   *   1. Filas de OTRO distrito (el modal permite cambiarlo) NO se mezclan
   *      en la vista actual — al seleccionar ese distrito, el fetch las trae.
   *   2. Dedupe por contenido (mismo criterio que `listUmbrales`): el
   *      `bulkSave` devuelve las filas SIN desduplicar y el modelo del
   *      backend no tiene unicidad — sin esto la tabla derecha duplicaba
   *      filas idénticas hasta recargar (el listado sí deduplica).
   */
  function handleSaved(rows: UmbralFenomeno[]) {
    if (rows.length === 0) return;
    const npId = rows[0].natural_phenomena.id;
    const varId = rows[0].variable.id;
    const ubigeo = rows[0].district.ubigeo;

    // Guard 1: el bulk guardó la escalera de otro distrito → no toca la
    // tabla del distrito actualmente seleccionado.
    if (ubigeo !== selectedUbigeo) return;

    // Guard 2: desduplicar por contenido antes de inyectar al estado.
    const dedupedRows = dedupeUmbrales(rows);

    setUmbrales((prev) => {
      const restantes = prev.filter(
        (u) =>
          !(
            u.district.ubigeo === ubigeo &&
            u.natural_phenomena.id === npId &&
            u.variable.id === varId
          ),
      );
      return [...restantes, ...dedupedRows];
    });
    setError(null);
  }

  const maxCategoria = maxInfo.umbral
    ? thresholdNameToCategoria(maxInfo.umbral.threshold.name)
    : null;
  const maxColor = maxCategoria ? GFS_COLOR_MAP[maxCategoria] : '#9ca3af';

  return (
    <div className="h-full overflow-y-auto p-6 text-text-primary">

      <div className="mb-5 flex flex-wrap items-end gap-6">
        <div className="flex flex-col gap-1.5">
          <label className="text-text-primary text-sm font-medium font-sans">
            Distrito
          </label>
          <FilterableSelect
            value={selectedUbigeo ?? ''}
            onChange={(v) => setSelectedUbigeo(v || null)}
            options={distritos.map((d) => ({
              value: d.ubigeo,
              label: d.nombre,
            }))}
            placeholder="Buscar distrito…"
            emptyLabel={distritosLoading ? 'Cargando distritos…' : '— Sin distritos —'}
            disabled={distritosLoading || distritos.length === 0}
          />
        </div>

        <button
          type="button"
          onClick={abrirCrear}
          disabled={selectedUbigeo === null}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-main
                     text-text-invert-primary text-sm font-medium font-sans
                     hover:bg-primary-light transition-colors
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main
                     disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
          Agregar umbral
        </button>

        <span className="px-2 py-2 text-text-secondary text-xs font-sans">
          {umbrales.length} umbral{umbrales.length === 1 ? '' : 'es'} definido{umbrales.length === 1 ? '' : 's'} para este distrito
        </span>
      </div>

      {error && (
        <p className="mb-4 text-red-600 text-sm font-sans" role="alert">
          {error}
        </p>
      )}

      {loadingUmbrales && (
        <p className="mb-4 text-text-secondary text-sm font-sans">
          Cargando umbrales…
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        {/* ── Panel izquierdo: máximo umbral registrado en GFS Clusters ─ */}
        <div className="p-5 rounded-2xl outline outline-1 outline-offset-[-1px] outline-input-stroke-main
                        flex flex-col gap-3 bg-background-main">
          <h2 className="text-text-primary text-base font-bold font-sans">
            Máximo umbral registrado
            <span className="ml-2 text-text-secondary text-xs font-normal">
              (GFS Clusters · ventana 18h)
            </span>
          </h2>

          {loadingClusters ? (
            <p className="text-text-secondary text-sm font-sans">Cargando clústeres…</p>
          ) : maxInfo.mmh === null ? (
            <p className="text-text-secondary text-sm font-sans">
              {selectedUbigeo
                ? 'No hay clústeres activos que afecten este distrito.'
                : 'Seleccione un distrito para ver su máximo registrado.'}
            </p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span
                  className="inline-block size-4 rounded-full shrink-0"
                  style={{ backgroundColor: maxColor }}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    'text-2xl font-bold font-sans tabular-nums',
                    maxCategoria ? 'text-primary-main' : 'text-text-primary',
                  )}
                >
                  {maxInfo.mmh.toFixed(2)}
                  <span className="text-sm font-normal text-text-secondary ml-1">
                    mm/h
                  </span>
                </span>
              </div>

              {maxInfo.umbral ? (
                <p className="text-sm font-sans text-text-primary">
                  Categoría:{' '}
                  <strong className="font-bold">
                    {(maxCategoria && GFS_LABEL[maxCategoria]) ?? maxInfo.umbral.threshold.name}
                  </strong>
                </p>
              ) : (
                <p className="text-sm font-sans text-text-secondary">
                  La intensidad pico supera los rangos definidos para este
                  distrito. Considere registrar un nuevo umbral.
                </p>
              )}
            </>
          )}
        </div>

        {/* ── Panel derecho: lista de umbrales (gris + activo en negrita) ─ */}
        <div className="p-5 rounded-2xl outline outline-1 outline-offset-[-1px] outline-input-stroke-main
                        flex flex-col gap-3 bg-background-main">
          <h2 className="text-text-primary text-base font-bold font-sans">
            Umbrales del distrito
            <span className="ml-2 text-text-secondary text-xs font-normal">
              (resaltado = rango del valor máximo actual)
            </span>
          </h2>

          {selectedUbigeo === null ? (
            <p className="text-text-secondary text-sm font-sans">
              Seleccione un distrito para ver su detalle.
            </p>
          ) : (
            <UmbralesTable
              umbrales={umbrales}
              activoId={activoId}
              onEdit={abrirEditar}
            />
          )}
        </div>
      </div>

      <EditorUmbral
        open={modalOpen}
        mode={modalMode}
        defaultDistrictUbigeo={editingCombo?.districtUbigeo ?? selectedUbigeo ?? undefined}
        defaultNaturalPhenomenaId={editingCombo?.naturalPhenomenaId}
        defaultVariableId={editingCombo?.variableId}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}
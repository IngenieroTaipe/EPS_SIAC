import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { FilterableSelect } from '@/shared/components/FilterableSelect';
import { useUnidadOperativa } from '@/shared/context/useUnidadOperativa';
import { apiUmbrales, type UmbralFenomeno } from '@/services/apiUmbrales';
import { apiGFS } from '@/services/apiGFS';
import type { GfsClusterFeatureCollection } from '@/features/mapa/types/gfs';
import { GFS_COLOR_MAP, GFS_LABEL } from '@/features/mapa/types/gfs';
import { thresholdNameToCategoria, valorEnRango } from '@/features/umbrales/types';
import { UmbralesTable } from './UmbralesTable';
import { EditorUmbral } from './EditorUmbral';

/**
 * GestionUmbrales — página de gestión de Umbrales de Fenómenos Naturales.
 *
 * Lógica (consolidada con el backend `core_predictive`):
 *
 *   1. Al montar se cargan TODOS los umbrales una sola vez; de ahí se derivan
 *      los distritos que tienen al menos un umbral registrado.
 *   2. El selector local "Unidad Operativa" lista SOLO esos distritos (sin
 *      opción "Todas"); se pre-selecciona el que tenga el máximo umbral
 *      registrado en GFS Clusters (ventana 18h).
 *   3. Para el distrito seleccionado se muestran en gris sus umbrales
 *      (filtrados en memoria) ordenados de menor a mayor rango.
 *   4. El máximo umbral registrado (max_intensity_mm_h de los clústeres cuyo
 *      `affected_ubigeos` incluye el distrito) se muestra en el panel;
 *      la fila del umbral cuyo rango [min,max) contiene ese valor se
 *      resalta en negrita / color de marca.
 *   5. Botón "Agregar umbral" abre el modal que hace POST al endpoint
 *      `/core_predictive/thresholds-natural-phenomenas/` (admite editar /
 *      eliminar un registro existente).
 */
export function GestionUmbrales() {
  const { branches } = useUnidadOperativa();
  const [todosUmbrales, setTodosUmbrales] = useState<UmbralFenomeno[]>([]);
  const [clusters, setClusters] = useState<GfsClusterFeatureCollection | null>(null);
  const [loadingUmbrales, setLoadingUmbrales] = useState(true);
  const [loadingClusters, setLoadingClusters] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedUbigeo, setSelectedUbigeo] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'editar' | 'agregar'>('agregar');
  const [editingCombo, setEditingCombo] = useState<{
    naturalPhenomenaId: number;
    variableId: number;
    districtUbigeo: string;
  } | null>(null);

  // 1. Cargar todos los umbrales una sola vez (para saber qué distritos
  //    tienen umbrales y operar el resto por filtro en memoria).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- secuencia de carga
       (loading true → fetch → loading false), patrón React canónico. */
    setLoadingUmbrales(true);
    apiUmbrales
      .listUmbrales()
      .then((all) => setTodosUmbrales(all))
      .catch(() => setError('No se pudieron cargar los umbrales.'))
      .finally(() => setLoadingUmbrales(false));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // 2. Cargar clústeres GFS (ventana 18h) una sola vez al montar.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- secuencia de carga
       (loading true → fetch → loading false), patrón React canónico. */
    setLoadingClusters(true);
    apiGFS
      .getWindow18h()
      .then((fc) => setClusters(fc))
      .catch(() => setClusters(null))
      .finally(() => setLoadingClusters(false));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // 3. Distritos con umbrales registrados (lista única ordenada) + nombre
  //    legible (mapeando ubigeo → nombre del branch asociado).
  const distritosConUmbrales = useMemo(() => {
    const map = new Map<string, string>(); // ubigeo → nombre legible
    for (const u of todosUmbrales) {
      const ub = u.district.ubigeo;
      if (!map.has(ub)) {
        const branch = branches.find((b) => {
          const bUb = typeof b.district === 'string' ? b.district : b.district?.ubigeo;
          return bUb === ub;
        });
        const nombreAmigable = branch?.name ?? u.district.name;
        map.set(ub, nombreAmigable);
      }
    }
    return Array.from(map.entries())
      .map(([ubigeo, nombre]) => ({ ubigeo, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [todosUmbrales, branches]);

  // 4. Máximo umbral registrado por distrito (GFS Clusters) — para
  //    pre-seleccionar el distrito con el mayor valor pico al cargar.
  const maxPorDistrito = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    if (!clusters) return out;
    const feats = clusters.features ?? [];
    for (const f of feats) {
      const v = f.properties.max_intensity_mm_h;
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      const ubgs = (f.properties.affected_ubigeos ?? []) as Array<string | null>;
      for (const ub of ubgs) {
        if (typeof ub !== 'string') continue;
        if (out[ub] === undefined || v > out[ub]) out[ub] = v;
      }
    }
    return out;
  }, [clusters]);

  // Pre-selección automática:
  //   - Prioriza el distrito con umbrales y mayor valor pico registrado.
  //   - Si ningún distrito con umbrales tiene clúster, toma el primer distrito
  //     con umbrales (orden alfabético).
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- auto-selección del
       distrito con mayor valor pico al cargar la página (one-shot). */
    if (selectedUbigeo !== null) return; // ya elegido manualmente
    if (distritosConUmbrales.length === 0) return;
    let candidato = distritosConUmbrales[0].ubigeo;
    let mejor = -Infinity;
    for (const d of distritosConUmbrales) {
      const v = maxPorDistrito[d.ubigeo];
      if (v !== undefined && v > mejor) {
        mejor = v;
        candidato = d.ubigeo;
      }
    }
    setSelectedUbigeo(candidato);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [distritosConUmbrales, maxPorDistrito, selectedUbigeo]);

  // 5. Umbrales del distrito seleccionado (filtro en memoria, sin fetch).
  const umbrales = useMemo<UmbralFenomeno[]>(() => {
    if (selectedUbigeo === null) return [];
    return todosUmbrales.filter((u) => u.district.ubigeo === selectedUbigeo);
  }, [todosUmbrales, selectedUbigeo]);

  // 6. Máximo umbral registrado GFS para el distrito seleccionado.
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
   * previas del mismo combo en `todosUmbrales`, dejando el resto del estado
   * intacto (otros distritos / fenómenos / variables).
   */
  function handleSaved(rows: UmbralFenomeno[]) {
    if (rows.length === 0) return;
    const npId = rows[0].natural_phenomena.id;
    const varId = rows[0].variable.id;
    const ubigeo = rows[0].district.ubigeo;
    setTodosUmbrales((prev) => {
      const restantes = prev.filter(
        (u) =>
          !(
            u.district.ubigeo === ubigeo &&
            u.natural_phenomena.id === npId &&
            u.variable.id === varId
          ),
      );
      return [...restantes, ...rows];
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
            options={distritosConUmbrales.map((d) => ({
              value: d.ubigeo,
              label: d.nombre,
            }))}
            placeholder="Buscar distrito…"
            emptyLabel="— Sin umbrales registrados —"
            disabled={distritosConUmbrales.length === 0}
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
                : 'Seleccione un distrito con umbrales para ver su máximo registrado.'}
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
              Seleccione un distrito con umbrales para ver su detalle.
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
        siblingsPool={todosUmbrales}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}
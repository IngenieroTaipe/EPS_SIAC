import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { AlertsTable } from '@/features/alertas/components/AlertsTable';
import { AlertaDetailSheet } from '@/features/alertas/components/AlertaDetailSheet';
import {
  ESTADO_LABEL,
  type AlertaHistorica,
} from '@/features/alertas/types';
import { ESTADOS_FILTRABLES } from '@/features/alertas/alerta-utils';
import { apiAlerts } from '@/services/apiAlerts';
import { mapAlertListToFrontend } from '@/features/alertas/alertAdapters';
import { FilterableSelect, type FilterableOption } from '@/shared/components/FilterableSelect';
import { useUnidadOperativa } from '@/shared/context/useUnidadOperativa';
import { UNIDAD_TODAS } from '@/shared/context/UnidadOperativaContext';

/** Máximo de sugerencias del autocompletado del buscador. */
const MAX_SUGERENCIAS = 8;

/**
 * HistoricoAlertasPage — vista "Gestión de Alertas" (tabla histórica con
 * filtros).
 *
 * Ruta: `/alertas/gestion`. Puede recibir `?id=ID` para resaltar y
 * pre-seleccionar una alerta (cuando el usuario entra desde el botón
 * "view" del panel del mapa u otra vista).
 *
 * Layout idéntico a `HistoricoComponentesPage`:
 *   - Contenedor `h-full flex flex-col overflow-hidden` → sólo la tabla
 *     y el sheet lateral scrollean; la barra de filtros queda fija arriba.
 *   - Tabla a la izquierda + `AlertaDetailSheet` a la derecha (estático,
 *     `floating=false`) al seleccionar una fila.
 *
 * Filtros (todos controles `FilterableSelect` salvo el buscador, que es
 * input con autocompletado, y el rango de fechas, que es nativo):
 *
 *   1. Buscar — input con sugerencias en vivo (dropdown de alertas que
 *      matchean código/fenómeno/distrito/unidad). Click en una sugerencia
 *      la fija y filtra la tabla.
 *   2. Unidad Operativa — `FilterableSelect` con las unidades activas del
 *      contexto global (branch.name, incluyendo "Todas").
 *   3. Estados — `FilterableSelect` multi (chips seleccionables con dot
 *      de color). Incluye "Seleccionar todos".
 *   4. Desde / 5. Hasta — nativos `type="date"` (compara contra
 *      `fechaCreacion`, que inicia el ciclo de vida de la alerta).
 *   6. Limpiar filtros — botón que resetea todo (sólo visible si hay
 *      filtros no-default).
 *
 * Notas sobre el modelo (ver `alertAdapters.ts`):
 *   el listado del backend NO incluye unidad operativa/distrito ni estado,
 *   así que esos filtros pueden no acotar resultados hasta que el backend
 *   los exponga. Mientras tanto, el filtro se mantiene en cliente para no
 *   romper la UI si el backend los agrega mañana.
 */
export function HistoricoAlertasPage() {
  const [searchParams] = useSearchParams();
  const preselectId = searchParams.get('id');

  const { selectedNombre, setSelectedNombre, branches } = useUnidadOperativa();

  const [alertas, setAlertas] = useState<AlertaHistorica[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── Filtros ────────────────────────────────────────────────────────
  const [busqueda, setBusqueda] = useState<string>('');
  const [busquedaAbierta, setBusquedaAbierta] = useState<boolean>(false);
  // Estados: por defecto TODOS seleccionados (= sin filtro). Es un array
  // de values (slugs), lo que espera `FilterableSelect` en modo multi.
  const [estadosSeleccionados, setEstadosSeleccionados] = useState<string[]>(
    ESTADOS_FILTRABLES,
  );
  const [desde, setDesde] = useState<string>('');
  const [hasta, setHasta] = useState<string>('');

  const [selectedId, setSelectedId] = useState<string | null>(preselectId);

  // Cargar alertas del backend al montar.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- secuencia de
       carga (loading true → fetch → loading false), patrón canónico. */
    setIsLoading(true);
    apiAlerts.listAlerts()
      .then((items) => setAlertas(items.map(mapAlertListToFrontend)))
      .catch((err) => console.error('Error cargando alertas:', err))
      .finally(() => setIsLoading(false));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // ── Opciones de filtros ───────────────────────────────────────────
  /** Opciones Unidad Operativa: "Todas" + branches activos. */
  const unidadOptions = useMemo<FilterableOption[]>(
    () => [
      { value: UNIDAD_TODAS, label: UNIDAD_TODAS },
      ...branches.map((b) => ({ value: b.name, label: b.name })),
    ],
    [branches],
  );

  /** Opciones Estados (labels legibles). */
  const estadosOptions = useMemo<FilterableOption[]>(
    () => ESTADOS_FILTRABLES.map((e) => ({ value: e, label: ESTADO_LABEL[e] })),
    [],
  );

  // ── Sugerencias del autocompletado ────────────────────────────────
  const sugerencias = useMemo<AlertaHistorica[]>(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return [];
    const out: AlertaHistorica[] = [];
    for (const a of alertas) {
      const hay = `${a.id} ${a.fenomeno} ${a.distrito} ${a.unidadOperativa}`.toLowerCase();
      if (hay.includes(q)) out.push(a);
      if (out.length >= MAX_SUGERENCIAS) break;
    }
    return out;
  }, [busqueda, alertas]);

  // ── Alertas filtradas (in-memory contra todos los filtros) ─────────
  const alertasFiltradas = useMemo<AlertaHistorica[]>(() => {
    const q = busqueda.trim().toLowerCase();
    const estadosSet = new Set(estadosSeleccionados);
    const unidad = selectedNombre === UNIDAD_TODAS ? '' : selectedNombre;
    return alertas.filter((a) => {
      if (unidad && a.unidadOperativa !== unidad && a.distrito !== unidad) return false;
      if (!estadosSet.has(a.estado)) return false;
      const fechaCreacion = new Date(a.fechaCreacion).getTime();
      if (desde) {
        const desdeTs = new Date(`${desde}T00:00:00`).getTime();
        if (fechaCreacion < desdeTs) return false;
      }
      if (hasta) {
        const hastaTs = new Date(`${hasta}T23:59:59`).getTime();
        if (fechaCreacion > hastaTs) return false;
      }
      if (q) {
        const hay = `${a.id} ${a.fenomeno} ${a.distrito} ${a.unidadOperativa}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [alertas, selectedNombre, estadosSeleccionados, desde, hasta, busqueda]);

  // Toggle real: clic en fila seleccionada la deselecciona.
  function handleToggleSelect(id: string) {
    setSelectedId((prev) => (prev === id ? null : id));
  }

  /** Abrir el sheet desde una fila de la tabla. */
  function handleOpenDetail(a: AlertaHistorica) {
    setSelectedId(a.id);
  }

  /** Alerta actualmente seleccionada para el sheet (lookup por id). */
  const selectedAlerta = useMemo<AlertaHistorica | null>(() => {
    if (!selectedId) return null;
    return alertas.find((a) => a.id === selectedId) ?? null;
  }, [alertas, selectedId]);

  // ── Flags para mostrar "Limpiar filtros" + estado activo ──────────
  const hayFiltrosActivos =
    busqueda.trim() !== '' ||
    selectedNombre !== UNIDAD_TODAS ||
    estadosSeleccionados.length !== ESTADOS_FILTRABLES.length ||
    desde !== '' ||
    hasta !== '';

  function limpiarFiltros() {
    setBusqueda('');
    setBusquedaAbierta(false);
    setSelectedNombre(UNIDAD_TODAS);
    setEstadosSeleccionados(ESTADOS_FILTRABLES);
    setDesde('');
    setHasta('');
  }

  // Cierra el dropdown del buscador al click fuera.
  useEffect(() => {
    if (!busquedaAbierta) return;
    function onClick(e: MouseEvent) {
      const el = e.target as HTMLElement | null;
      if (el && el.closest('[data-buscador-root]')) return;
      setBusquedaAbierta(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [busquedaAbierta]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 text-text-primary">

      {/* ── Barra de filtros (una fila, flex-wrap a 2 si no cabe) ──── */}
      <div className="mb-5 flex flex-wrap items-end gap-4 shrink-0">
        {/* 1. Buscar (input con autocompletado) */}
        <div className="flex flex-col gap-1.5 relative" data-buscador-root>
          <label className="text-text-primary text-sm font-medium font-sans">Buscar</label>
          <div className="relative w-72">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-icon-main pointer-events-none"
              strokeWidth={2}
              aria-hidden="true"
            />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setBusquedaAbierta(true);
              }}
              onFocus={() => setBusquedaAbierta(true)}
              placeholder="Código, fenómeno o unidad"
              className="w-full pl-9 pr-9 py-2.5 rounded-xl outline outline-1 outline-offset-[-1px] outline-button-stroke bg-background-main text-text-primary font-sans text-sm
                         focus:outline-2 focus:outline-primary-main
                         placeholder:text-text-secondary"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => {
                  setBusqueda('');
                  setBusquedaAbierta(false);
                }}
                aria-label="Borrar búsqueda"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-secondary hover:text-text-primary"
              >
                <X className="size-4" strokeWidth={2} aria-hidden="true" />
              </button>
            )}

            {/* Dropdown de sugerencias */}
            {busquedaAbierta && sugerencias.length > 0 && (
              <div
                role="listbox"
                className="absolute z-50 mt-1 left-0 right-0 bg-background-main rounded-xl outline outline-1 outline-offset-[-1px] outline-button-stroke shadow-lg
                           max-h-72 overflow-y-auto py-1"
              >
                {sugerencias.map((a) => {
                  const label = a.id;
                  const sub = [a.fenomeno, a.unidadOperativa].filter(Boolean).join(' · ');
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        setBusqueda(label);
                        setBusquedaAbierta(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm font-sans transition-colors
                                 text-text-primary hover:bg-primary-states-hover-main/30
                                 flex flex-col gap-0.5"
                    >
                      <span className="font-medium truncate">{label}</span>
                      {sub && (
                        <span className="text-xs text-text-secondary truncate">{sub}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 2. Unidad Operativa */}
        <div className="flex flex-col gap-1.5 w-64">
          <label className="text-text-primary text-sm font-medium font-sans">
            Unidad Operativa
          </label>
          <FilterableSelect
            value={selectedNombre}
            onChange={(v) => setSelectedNombre(v)}
            options={unidadOptions}
            placeholder="Buscar unidad…"
            emptyLabel="— Todas —"
          />
        </div>

        {/* 3. Estados (multi-select) */}
        <div className="flex flex-col gap-1.5 w-72">
          <label className="text-text-primary text-sm font-medium font-sans">Estados</label>
          <FilterableSelect
            multiselect
            value={estadosSeleccionados}
            onChange={(v) => setEstadosSeleccionados(v)}
            options={estadosOptions}
            placeholder="Buscar estado…"
            emptyLabel="— Todos —"
            allLabel="Todos los estados"
          />
        </div>

        {/* 4. Fecha desde */}
        <div className="flex flex-col gap-1.5">
          <label className="text-text-primary text-sm font-medium font-sans">Desde</label>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="w-40 px-3 py-2.5 rounded-xl outline outline-1 outline-offset-[-1px] outline-button-stroke bg-background-main text-text-primary font-sans text-sm
                       focus:outline-2 focus:outline-primary-main"
          />
        </div>

        {/* 5. Fecha hasta */}
        <div className="flex flex-col gap-1.5">
          <label className="text-text-primary text-sm font-medium font-sans">Hasta</label>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="w-40 px-3 py-2.5 rounded-xl outline outline-1 outline-offset-[-1px] outline-button-stroke bg-background-main text-text-primary font-sans text-sm
                       focus:outline-2 focus:outline-primary-main"
          />
        </div>

        {/* 6. Limpiar filtros (solo si hay filtros no-default) */}
        {hayFiltrosActivos && (
          <button
            type="button"
            onClick={limpiarFiltros}
            className="self-end px-3 py-2.5 rounded-lg outline outline-1 outline-offset-[-1px]
                       outline-button-stroke text-text-primary text-sm font-medium font-sans
                       hover:bg-primary-states-hover-main/30 transition-colors"
          >
            Limpiar filtros
          </button>
        )}

        {/* Contador de resultados (al final de la fila) */}
        <span className="ml-auto self-end px-2 py-2 text-text-secondary text-xs font-sans">
          {isLoading
            ? 'Cargando…'
            : `${alertasFiltradas.length} resultado${alertasFiltradas.length === 1 ? '' : 's'}`}
        </span>
      </div>

      {/* ── Tabla + Sheet lateral ─────────────────────────────────── */}
      <div className="flex flex-1 gap-4 min-h-0">
        <div className="flex-1 overflow-auto min-w-0 rounded-xl border border-input-stroke-main">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-text-secondary text-sm font-sans">Cargando alertas...</p>
            </div>
          ) : (
            <AlertsTable
              alertas={alertasFiltradas}
              selectedId={selectedId}
              onToggleSelect={handleToggleSelect}
              onOpenDetail={handleOpenDetail}
              sortSelectedFirst
              fixedWidths
              variant="gestion"
            />
          )}
        </div>

        {/* Sheet de detalle (estático, al lado de la tabla) */}
        {selectedAlerta && (
          <div className="w-[26rem] shrink-0">
            <AlertaDetailSheet
              alerta={selectedAlerta}
              onClose={() => setSelectedId(null)}
              floating={false}
            />
          </div>
        )}
      </div>

      {/* Empty state si no hay resultados */}
      {!isLoading && alertasFiltradas.length === 0 && (
        <div className="mt-6 text-center text-text-secondary text-sm font-sans">
          No hay alertas que coincidan con los filtros seleccionados.
        </div>
      )}

      {preselectId && (
        <div className="mt-4 text-text-secondary text-xs font-sans">
          Alerta pre-seleccionada desde el mapa:{' '}
          <strong className="text-primary-main">{preselectId}</strong>
        </div>
      )}
    </div>
  );
}
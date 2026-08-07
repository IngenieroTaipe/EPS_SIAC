import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { ComponentsTable } from '@/features/componentes/components/ComponentsTable';
import { ComponenteDetailSheet } from '@/features/componentes/components/ComponenteDetailSheet';
import {
  CRITICIDAD_LABEL,
  TIPO_LABEL,
  type Componente,
  type CriticidadComponente,
  type TipoComponente,
} from '@/features/mapa/types/componente';
import { useComponentes } from '@/services/useComponentes';
import { FilterableSelect, type FilterableOption } from '@/shared/components/FilterableSelect';
import { apiOrganization, type BackendBranch } from '@/services/apiOrganization';

/** Tipos de componente filtrables, en el orden legible de TIPO_LABEL. */
const TIPOS: TipoComponente[] = Object.keys(TIPO_LABEL) as TipoComponente[];

/** Criticidades filtrables. */
const CRITICIDADES: CriticidadComponente[] = ['alta', 'media', 'baja'];

/** Máximo de sugerencias del autocompletado del buscador. */
const MAX_SUGERENCIAS = 8;

/**
 * HistoricoComponentesPage — vista "Gestión de Componentes" (tabla
 * histórica con filtros).
 *
 * Ruta: `/componentes/gestion`. Puede recibir `?id=ID` para resaltar y
 * pre-seleccionar un componente (cuando el usuario entra desde el panel
 * "Ver detalle" del mapa u otra vista).
 *
 * La tabla aquí es **informativa**: solo un botón "Editar" por fila que
 * navega a `/componentes/:id/editar`.
 *
 * Filtros (todos desplegables salvo el buscador, que es input con
 * autocompletado):
 *
 *   1. Buscar — input con sugerencias en vivo (dropdown de componentes que
 *      matchean código/nombre/especificación). Click en una sugerencia la
 *      fija y filtra la tabla.
 *   2. Unidad Operativa — `FilterableSelect` consumiendo
 *      `GET /organization/branches/` (sólo activas). Cada branch está
 *      asociado a un `district.name` que se compara contra
 *      `componente.unidadOperativa`.
 *   3. Tipo — `FilterableSelect` con los 11 tipos de TIPO_LABEL.
 *   4. Criticidad — `FilterableSelect` con Alta/Media/Baja.
 *   5. Limpiar filtros — botón que resetea todo a default (vacío = sin
 *      filtro).
 */
export function HistoricoComponentesPage() {
  const [searchParams] = useSearchParams();
  const preselectId = searchParams.get('id');

  const { data } = useComponentes();
  const todosComponentes = useMemo(() => data.componentes ?? [], [data]);

  // ── Filtros (single-select; "" = sin filtro) ──────────────────────
  const [busqueda, setBusqueda] = useState<string>('');
  const [busquedaAbierta, setBusquedaAbierta] = useState<boolean>(false);
  const [unidadDistritoName, setUnidadDistritoName] = useState<string>(''); // backend district name
  const [tipo, setTipo] = useState<string>('');
  const [criticidad, setCriticidad] = useState<string>('');

  const [selectedId, setSelectedId] = useState<string | null>(preselectId);

  // ── Sucursales (unidades operativas) desde el backend ────────────
  const [branches, setBranches] = useState<BackendBranch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect -- secuencia de
       carga (loading true → fetch → loading false), patrón canónico. */
    setBranchesLoading(true);
    apiOrganization
      .listBranches({ status: true })
      .then((list) => {
        if (!cancelled) setBranches(list);
      })
      .catch(() => {
        if (!cancelled) setBranches([]);
      })
      .finally(() => {
        if (!cancelled) setBranchesLoading(false);
      });
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => {
      cancelled = true;
    };
  }, []);

  /** Resuelve el `district.name` (backend) de un branch a partir del
   *  nombre (upper) del distrito. */
  const branchesOptions = useMemo<FilterableOption[]>(() => {
    return branches
      .filter((b) => {
        const dist = typeof b.district === 'string' ? null : b.district;
        return dist && dist.ubigeo && dist.name;
      })
      .map((b) => {
        const dist = b.district as { ubigeo: string; name: string };
        return {
          value: dist.name, // backend district name, comparable con componente.unidadOperativa
          label: b.name,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }, [branches]);

  /** Opciones del filtro Tipo (labels legibles). */
  const tiposOptions = useMemo<FilterableOption[]>(
    () => TIPOS.map((t) => ({ value: t, label: TIPO_LABEL[t] })),
    [],
  );

  /** Opciones del filtro Criticidad (labels legibles). */
  const criticidadOptions = useMemo<FilterableOption[]>(
    () => CRITICIDADES.map((c) => ({ value: c, label: CRITICIDAD_LABEL[c] })),
    [],
  );

  // ── Sugerencias del autocompletado ───────────────────────────────
  const sugerencias = useMemo<Componente[]>(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return [];
    const out: Componente[] = [];
    for (const c of todosComponentes) {
      const hay = `${c.codigo} ${c.nombre} ${c.especificacion}`.toLowerCase();
      if (hay.includes(q)) out.push(c);
      if (out.length >= MAX_SUGERENCIAS) break;
    }
    return out;
  }, [busqueda, todosComponentes]);

  // ── Componentes filtrados (in-memory contra los 4 filtros) ─────────
  const componentesFiltrados = useMemo<Componente[]>(() => {
    const q = busqueda.trim().toLowerCase();
    return todosComponentes.filter((c) => {
      if (unidadDistritoName && c.unidadOperativa !== unidadDistritoName) return false;
      if (tipo && c.tipo !== tipo) return false;
      if (criticidad && c.criticidad !== criticidad) return false;
      if (q) {
        const hay = `${c.codigo} ${c.nombre} ${c.especificacion}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [todosComponentes, unidadDistritoName, tipo, criticidad, busqueda]);

  function handleToggleSelect(id: string) {
    setSelectedId((prev) => (prev === id ? null : id));
  }

  /** Componente actualmente seleccionado para el sheet (lookup por id). */
  const selectedComponente = useMemo<Componente | null>(() => {
    if (!selectedId) return null;
    return componentesFiltrados.find((c) => c.id === selectedId) ?? null;
  }, [componentesFiltrados, selectedId]);

  /** Abrir el sheet desde una fila de la tabla. */
  function handleOpenDetail(c: Componente) {
    setSelectedId(c.id);
  }

  // ── Flags para mostrar "Limpiar filtros" + estado activo ──────────
  const hayFiltrosActivos =
    busqueda.trim() !== '' ||
    unidadDistritoName !== '' ||
    tipo !== '' ||
    criticidad !== '';

  function limpiarFiltros() {
    setBusqueda('');
    setUnidadDistritoName('');
    setTipo('');
    setCriticidad('');
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
              placeholder="Código, nombre o especificación"
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
                {sugerencias.map((c) => {
                  const label = c.nombre || c.codigo;
                  const sub = [c.codigo, c.unidadOperativa].filter(Boolean).join(' · ');
                  return (
                    <button
                      key={c.id}
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
            value={unidadDistritoName}
            onChange={(v) => setUnidadDistritoName(v)}
            options={branchesOptions}
            placeholder="Buscar unidad…"
            emptyLabel={branchesLoading ? 'Cargando…' : '— Todas —'}
            disabled={branchesLoading}
          />
        </div>

        {/* 3. Tipo */}
        <div className="flex flex-col gap-1.5 w-64">
          <label className="text-text-primary text-sm font-medium font-sans">Tipo</label>
          <FilterableSelect
            value={tipo}
            onChange={(v) => setTipo(v)}
            options={tiposOptions}
            placeholder="Buscar tipo…"
            emptyLabel="— Todos —"
          />
        </div>

        {/* 4. Criticidad */}
        <div className="flex flex-col gap-1.5 w-56">
          <label className="text-text-primary text-sm font-medium font-sans">Criticidad</label>
          <FilterableSelect
            value={criticidad}
            onChange={(v) => setCriticidad(v)}
            options={criticidadOptions}
            placeholder="Buscar…"
            emptyLabel="— Todas —"
          />
        </div>

        {/* 5. Limpiar filtros (solo si hay filtros no-default) */}
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
          {componentesFiltrados.length} resultado{componentesFiltrados.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        <div className="flex-1 overflow-auto min-w-0 rounded-xl border border-input-stroke-main">
          <ComponentsTable
            componentes={componentesFiltrados}
            selectedId={selectedId}
            onToggleSelect={handleToggleSelect}
            onOpenDetail={handleOpenDetail}
            sortSelectedFirst
            fixedWidths
            variant="gestion"
          />
        </div>

        {/* Sheet de detalle (estático, al lado de la tabla) */}
        {selectedComponente && (
          <div className="w-[26rem] shrink-0">
            <ComponenteDetailSheet
              componente={selectedComponente}
              onClose={() => setSelectedId(null)}
              floating={false}
            />
          </div>
        )}
      </div>

      {componentesFiltrados.length === 0 && (
        <div className="mt-6 text-center text-text-secondary text-sm font-sans">
          No hay componentes que coincidan con los filtros seleccionados.
        </div>
      )}

      {preselectId && (
        <div className="mt-4 text-text-secondary text-xs font-sans">
          Componente pre-seleccionado desde el mapa:{' '}
          <strong className="text-primary-main">{preselectId}</strong>
        </div>
      )}
    </div>
  );
}
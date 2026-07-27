import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ComponentsTable } from '@/features/componentes/components/ComponentsTable';
import {
  CRITICIDAD_LABEL,
  type Componente,
  type CriticidadComponente,
} from '@/features/mapa/types/componente';
import { cn } from '@/shared/lib/cn';
import { useComponentes } from '@/services/useComponentes';
import { apiPlaces, type BackendDistrict } from '@/services/apiPlaces';

/** Criticidades filtrables (con dot de color). */
const CRITICIDADES: CriticidadComponente[] = ['alta', 'media', 'baja'];

const CRITICIDAD_DOT: Record<CriticidadComponente, string> = {
  'alta': 'bg-danger-main',
  'media': 'bg-warning-main',
  'baja': 'bg-success-main',
};

/**
 * HistoricoComponentesPage — vista de tabla histórica con filtros.
 *
 * Ruta: `/componentes/gestion`. La misma ruta puede recibir query param
 * `?id=ID` para pre-seleccionar un componente (cuando el usuario entra
 * desde el "view" del panel del mapa). En este caso, se resalta la fila
 * en la tabla y se hace scroll automático para mostrarla.
 */
export function HistoricoComponentesPage() {
  const [searchParams] = useSearchParams();
  const preselectId = searchParams.get('id');

  const { data } = useComponentes();

  const [distritos, setDistritos] = useState<BackendDistrict[]>([]);
  const [unidad, setUnidad] = useState<string>('Todas');
  const [criticidadesSeleccionadas, setCriticidadesSeleccionadas] = useState<
    Set<CriticidadComponente>
  >(() => new Set(CRITICIDADES));
  const [desde, setDesde] = useState<string>('');
  const [hasta, setHasta] = useState<string>('');

  const [selectedId, setSelectedId] = useState<string | null>(preselectId);

  useEffect(() => {
    apiPlaces
      .listDistricts()
      .then(setDistritos)
      .catch(() => []);
  }, []);

  const componentesFiltrados = useMemo<Componente[]>(() => {
    return (data.componentes ?? []).filter((c) => {
      if (unidad !== 'Todas' && c.unidadOperativa !== unidad) return false;
      if (!criticidadesSeleccionadas.has(c.criticidad)) return false;
      if (c.fechaActualizacion) {
        const ts = new Date(c.fechaActualizacion).getTime();
        if (desde) {
          const desdeTs = new Date(`${desde}T00:00:00`).getTime();
          if (ts < desdeTs) return false;
        }
        if (hasta) {
          const hastaTs = new Date(`${hasta}T23:59:59`).getTime();
          if (ts > hastaTs) return false;
        }
      }
      return true;
    });
  }, [data, unidad, criticidadesSeleccionadas, desde, hasta]);

  function handleToggleSelect(id: string) {
    setSelectedId((prev) => (prev === id ? null : id));
  }

  const unidadOptions = useMemo(() => {
    const names = distritos.map((d) => d.name);
    return ['Todas', ...Array.from(new Set(names))];
  }, [distritos]);

  return (
    <div className="h-full overflow-y-auto p-6 text-text-primary">
      <h1 className="text-h2 font-bold text-primary-main mb-4 font-sans">
        Histórico de Componentes
      </h1>

      <div className="mb-5 flex flex-wrap items-end gap-6">
        <div className="flex flex-col gap-1.5">
          <label className="text-text-primary text-sm font-medium font-sans">Unidad Operativa</label>
          <select
            value={unidad}
            onChange={(e) => setUnidad(e.target.value)}
            className="px-3 py-2 rounded-lg outline outline-1 outline-offset-[-1px] outline-button-stroke bg-button-fill-button text-text-primary font-sans text-sm
                       focus:outline-2 focus:outline-primary-main"
          >
            {unidadOptions.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-text-primary text-sm font-medium font-sans">Criticidad</label>
          <div className="flex flex-wrap items-center gap-2">
            {CRITICIDADES.map((crit) => {
              const isOn = criticidadesSeleccionadas.has(crit);
              return (
                <button
                  key={crit}
                  type="button"
                  onClick={() =>
                    setCriticidadesSeleccionadas((prev) => {
                      const next = new Set(prev);
                      if (next.has(crit)) next.delete(crit);
                      else next.add(crit);
                      return next;
                    })
                  }
                  className={cn(
                    'inline-flex items-center gap-2 px-3 py-2 rounded-lg outline outline-1 outline-offset-[-1px] text-sm font-sans cursor-pointer transition-colors',
                    isOn
                      ? 'bg-primary-states-hover-main outline-primary-main text-primary-main font-bold'
                      : 'bg-background-main outline-button-stroke text-text-primary hover:bg-primary-states-hover-main/30',
                  )}
                >
                  <span className={`size-2.5 rounded-full ${CRITICIDAD_DOT[crit]}`} />
                  {CRITICIDAD_LABEL[crit]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-text-primary text-sm font-medium font-sans">Desde</label>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="px-3 py-2 rounded-lg outline outline-1 outline-offset-[-1px] outline-button-stroke bg-button-fill-button text-text-primary font-sans text-sm
                       focus:outline-2 focus:outline-primary-main"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-text-primary text-sm font-medium font-sans">Hasta</label>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="px-3 py-2 rounded-lg outline outline-1 outline-offset-[-1px] outline-button-stroke bg-button-fill-button text-text-primary font-sans text-sm
                       focus:outline-2 focus:outline-primary-main"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            setUnidad('Todas');
            setCriticidadesSeleccionadas(new Set(CRITICIDADES));
            setDesde('');
            setHasta('');
          }}
          className="px-4 py-2 rounded-lg outline outline-1 outline-offset-[-1px] outline-button-stroke text-text-primary text-sm font-medium font-sans
                     hover:bg-primary-states-hover-main/30 transition-colors"
        >
          Limpiar filtros
        </button>

        <span className="px-2 py-2 text-text-secondary text-xs font-sans">
          {componentesFiltrados.length} resultado{componentesFiltrados.length === 1 ? '' : 's'}
        </span>
      </div>

      <ComponentsTable
        componentes={componentesFiltrados}
        selectedId={selectedId}
        onToggleSelect={handleToggleSelect}
        sortSelectedFirst
        fixedWidths
        showNombre
      />

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
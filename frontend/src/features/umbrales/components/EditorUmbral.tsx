import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  FilterableSelect,
  FilterableField,
} from '@/shared/components/FilterableSelect';
import {
  apiUmbrales,
  type LightRef,
  type UmbralFenomeno,
  type UmbralInput,
} from '@/services/apiUmbrales';
import { apiPlaces, type BackendDistrict } from '@/services/apiPlaces';
import { validarContinuidad } from '@/features/umbrales/continuous-validation';

/**
 * EditorUmbral — modal de creación / edición de un Umbral de Fenómeno Natural.
 *
 * Contrato backend (PR de `Predictive / Thresholds of Natural Phenomena`):
 *   POST   /api/v1/core_predictive/thresholds-natural-phenomenas/
 *   PATCH  /api/v1/core_predictive/thresholds-natural-phenomenas/:id/
 *   DELETE /api/v1/core_predictive/thresholds-natural-phenomenas/:id/
 *
 * Campos obligatorios: natural_phenomena (id), variable (id), threshold (id),
 * district (ubigeo). De min_value/max_value al menos uno debe venir.
 * Si ambos vienen, min_value <= max_value.
 *
 * En edición se fijan fenómeno, variable y distrito (clave natural) y sólo se
 * permite ajustar la categoría (`threshold`) y los rangos min/max.
 * En creación todos los campos son editables: el `defaultDistrictUbigeo` se
 * pre-selecciona pero el usuario puede cambiarlo libremente.
 */

interface EditorUmbralProps {
  open: boolean;
  /** Registro a editar; si null, es creación. */
  initial?: UmbralFenomeno | null;
  /** Distrito pre-seleccionado (ubigeo) para crear. Opcional. */
  defaultDistrictUbigeo?: string;
  /**
   * Pool con TODOS los umbrales cargados (dedupeados), usado para validar
   * la continuidad de rangos contra los hermanos del mismo
   * (distrito + fenómeno + variable). Si se omite, se omite la validación
   * de continuidad (sólo queda min<=max).
   */
  siblingsPool?: UmbralFenomeno[];
  onClose: () => void;
  onSaved: (u: UmbralFenomeno) => void;
  onDeleted?: (id: number) => void;
}

type Opcion = { value: string; label: string };

function toOpcion(r: LightRef): Opcion {
  return { value: String(r.id), label: r.name };
}

export function EditorUmbral({
  open,
  initial,
  defaultDistrictUbigeo,
  siblingsPool,
  onClose,
  onSaved,
  onDeleted,
}: EditorUmbralProps) {
  const [naturalPhenomenaOptions, setNaturalPhenomenaOptions] = useState<Opcion[]>([]);
  const [variableOptions, setVariableOptions] = useState<Opcion[]>([]);
  const [thresholdOptions, setThresholdOptions] = useState<Opcion[]>([]);
  const [districtOptions, setDistrictOptions] = useState<BackendDistrict[]>([]);

  const [naturalPhenomenaId, setNaturalPhenomenaId] = useState<string>('');
  const [variableId, setVariableId] = useState<string>('');
  const [thresholdId, setThresholdId] = useState<string>('');
  const [districtUbigeo, setDistrictUbigeo] = useState<string>('');

  const [minValue, setMinValue] = useState<string>('');
  const [maxValue, setMaxValue] = useState<string>('');

  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  const esEdicion = !!initial?.id;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !guardando && !eliminando) onClose();
    }
    document.addEventListener('keydown', onKey);
    cancelBtnRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, guardando, eliminando]);

  // Cargar catálogos al abrir.
  useEffect(() => {
    if (!open) return;
    // Cargar catálogos por separado: si uno falla (p. ej. 401 por sesión
    // expirada o un endpoint con IsAuthenticated) no bloqueamos el resto y
    // mostramos un mensaje específico con el código HTTP real para diagnosticar.
    Promise.allSettled([
      apiUmbrales.listNaturalPhenomena(),
      apiUmbrales.listVariables(),
      apiUmbrales.listThresholds(),
      apiPlaces.listDistrictsLight(),
    ]).then(([np, vs, ts, ds]) => {
      const fallos: string[] = [];
      if (np.status === 'fulfilled') setNaturalPhenomenaOptions(np.value.map(toOpcion));
      else fallos.push(`Fenómenos (${describirError(np.reason)})`);
      if (vs.status === 'fulfilled') setVariableOptions(vs.value.map(toOpcion));
      else fallos.push(`Variables (${describirError(vs.reason)})`);
      if (ts.status === 'fulfilled') setThresholdOptions(ts.value.map(toOpcion));
      else fallos.push(`Umbrales (${describirError(ts.reason)})`);
      if (ds.status === 'fulfilled') setDistrictOptions(ds.value);
      else fallos.push(`Distritos (${describirError(ds.reason)})`);
      if (fallos.length === 4) {
        setError('No se pudieron cargar los catálogos: ' + fallos.join(', ') + '.');
      } else if (fallos.length > 0) {
        setError('Algunos catálogos no cargaron: ' + fallos.join(', ') + '.');
      }
    });
  }, [open]);

  // Reset campos al abrir / cambiar target.
  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect -- reset sincrónico de
       formulario al abrir el modal (patrón React canónico para modales). */
    setError(null);
    if (initial) {
      setNaturalPhenomenaId(String(initial.natural_phenomena.id));
      setVariableId(String(initial.variable.id));
      setThresholdId(String(initial.threshold.id));
      setDistrictUbigeo(initial.district.ubigeo);
      setMinValue(initial.min_value !== null ? String(initial.min_value) : '');
      setMaxValue(initial.max_value !== null ? String(initial.max_value) : '');
    } else {
      setNaturalPhenomenaId('');
      setVariableId('');
      setThresholdId('');
      setDistrictUbigeo(defaultDistrictUbigeo ?? '');
      setMinValue('');
      setMaxValue('');
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, initial, defaultDistrictUbigeo]);

  if (!open) return null;

  function buildBody(): UmbralInput | null {
    if (!naturalPhenomenaId || !variableId || !thresholdId || !districtUbigeo) {
      setError('Fenómeno, variable, umbral y distrito son obligatorios.');
      return null;
    }
    const min = minValue.trim() === '' ? null : Number(minValue);
    const max = maxValue.trim() === '' ? null : Number(maxValue);
    if (min === null && max === null) {
      setError('Indique al menos un valor límite (mínimo o máximo).');
      return null;
    }
    if (min !== null && Number.isNaN(min)) {
      setError('El valor mínimo no es numérico.');
      return null;
    }
    if (max !== null && Number.isNaN(max)) {
      setError('El valor máximo no es numérico.');
      return null;
    }
    if (min !== null && max !== null && min > max) {
      setError('El valor mínimo no puede ser mayor que el máximo.');
      return null;
    }

    // Validación de continuidad contra los hermanos del mismo
    // (distrito + fenómeno + variable). Los rangos deben encadenarse sin
    // solapes ni huecos: el min de este umbral debe igualar al max del
    // umbral inferior, y el max de este debe igualar al min del superior.
    if (siblingsPool && siblingsPool.length > 0) {
      const npId = Number(naturalPhenomenaId);
      const varId = Number(variableId);
      const thrId = Number(thresholdId);
      const siblings = siblingsPool.filter(
        (u) =>
          u.district?.ubigeo === districtUbigeo &&
          u.natural_phenomena?.id === npId &&
          u.variable?.id === varId &&
          u.threshold?.id !== thrId, // excluir su propia categoría
      );
      const res = validarContinuidad(min, max, siblings, initial?.id);
      if (!res.ok) {
        setError(res.mensaje);
        return null;
      }
    }

    setError(null);
    return {
      natural_phenomena: Number(naturalPhenomenaId),
      variable: Number(variableId),
      district: districtUbigeo,
      threshold: Number(thresholdId),
      min_value: min,
      max_value: max,
    };
  }

  async function handleGuardar() {
    const body = buildBody();
    if (!body) return;
    setGuardando(true);
    try {
      const saved = initial?.id
        ? await apiUmbrales.updateUmbral(initial.id, body)
        : await apiUmbrales.createUmbral(body);
      onSaved(saved);
      onClose();
    } catch (err: unknown) {
      setError(extraerError(err));
    } finally {
      setGuardando(false);
    }
  }

  async function handleEliminar() {
    if (!initial?.id || !onDeleted) return;
    if (!confirm('¿Eliminar este umbral? Esta acción no se puede deshacer.')) return;
    setEliminando(true);
    try {
      await apiUmbrales.deleteUmbral(initial.id);
      onDeleted(initial.id);
      onClose();
    } catch (err: unknown) {
      setError(extraerError(err));
    } finally {
      setEliminando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !guardando && !eliminando) onClose();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-umbral-title"
        className="w-full max-w-2xl bg-background-main rounded-section shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] p-6 flex flex-col gap-5"
      >
        <h2 id="editor-umbral-title" className="text-xl font-bold font-sans text-primary-main">
          {esEdicion ? 'Editar Umbral' : 'Nuevo Umbral'}
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <FilterableField label="Fenómeno Natural" required>
            <FilterableSelect
              value={naturalPhenomenaId}
              onChange={setNaturalPhenomenaId}
              options={naturalPhenomenaOptions}
              placeholder="Buscar fenómeno…"
              emptyLabel="— Seleccionar fenómeno —"
              disabled={esEdicion}
            />
          </FilterableField>

          <FilterableField label="Variable" required>
            <FilterableSelect
              value={variableId}
              onChange={setVariableId}
              options={variableOptions}
              placeholder="Buscar variable…"
              emptyLabel="— Seleccionar variable —"
              disabled={esEdicion}
            />
          </FilterableField>

          <FilterableField label="Umbral (categoría)" required>
            <FilterableSelect
              value={thresholdId}
              onChange={setThresholdId}
              options={thresholdOptions}
              placeholder="Buscar umbral…"
              emptyLabel="— Seleccionar umbral —"
            />
          </FilterableField>

          <FilterableField label="Distrito (Unidad Operativa)" required>
            <FilterableSelect
              value={districtUbigeo}
              onChange={setDistrictUbigeo}
              options={districtOptions.map((d) => ({ value: d.ubigeo, label: d.name }))}
              placeholder="Buscar distrito…"
              emptyLabel="— Seleccionar distrito —"
              disabled={esEdicion}
            />
          </FilterableField>

          <Field label="Valor mínimo (mm/h)">
            <input
              type="number"
              step="any"
              value={minValue}
              onChange={(e) => setMinValue(e.target.value)}
              placeholder="Ej. 1.6 (vacío = sin piso)"
              className="w-full bg-background-main rounded-xl outline outline-1 outline-offset-[-1px] outline-button-stroke px-4 py-2.5 text-text-primary text-sm font-sans focus:outline-2 focus:outline-primary-main"
            />
          </Field>

          <Field label="Valor máximo (mm/h)">
            <input
              type="number"
              step="any"
              value={maxValue}
              onChange={(e) => setMaxValue(e.target.value)}
              placeholder="Ej. 3.2 (vacío = sin techo)"
              className="w-full bg-background-main rounded-xl outline outline-1 outline-offset-[-1px] outline-button-stroke px-4 py-2.5 text-text-primary text-sm font-sans focus:outline-2 focus:outline-primary-main"
            />
          </Field>
        </div>

        <p className="text-text-secondary text-xs font-sans">
          Al menos uno de los dos valores (mín/máx) debe estar definido. Si ambos
          vienen, el mínimo no puede superar al máximo.
        </p>

        {error && (
          <p className="text-red-600 text-sm font-sans" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end items-center gap-3">
          {esEdicion && (
            <button
              type="button"
              onClick={handleEliminar}
              disabled={guardando || eliminando}
              className="px-5 py-2.5 rounded-xl bg-secondary-main text-white text-sm font-medium font-sans
                         hover:bg-secondary-background transition-colors
                         disabled:opacity-60 disabled:cursor-not-allowed mr-auto"
            >
              {eliminando ? 'Eliminando…' : 'Eliminar'}
            </button>
          )}
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onClose}
            disabled={guardando || eliminando}
            className="px-5 py-2.5 rounded-xl outline outline-1 outline-offset-[-1px] outline-button-stroke text-text-primary text-sm font-medium font-sans
                       hover:bg-primary-states-hover-main/30 transition-colors
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleGuardar}
            disabled={guardando}
            className="px-5 py-2.5 rounded-xl bg-primary-main text-text-invert-primary text-sm font-medium font-sans
                       hover:bg-primary-light transition-colors
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {guardando
              ? 'Guardando…'
              : esEdicion
                ? 'Guardar Cambios'
                : 'Guardar Umbral'}
          </button>
        </div>
      </div>
    </div>
  );
}

function extraerError(err: unknown): string {
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
  return 'Error al guardar el umbral.';
}

/**
 * Resume un error de axios a un texto breve para mostrar al usuario, incluye
 * el código HTTP cuando es posible (p. ej. "401", "500"). Útil para
 * diagnosticar por qué un catálogo no carga en el modal.
 */
function describirError(err: unknown): string {
  const e = err as { response?: { status?: number; statusText?: string } };
  const status = e?.response?.status;
  if (typeof status === 'number') {
    return `HTTP ${status}${e?.response?.statusText ? ' ' + e.response.statusText : ''}`;
  }
  return 'sin respuesta';
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-text-primary text-sm font-medium font-sans">
        {label}
        {required && <span className="text-secondary-main"> *</span>}
      </label>
      {children}
    </div>
  );
}
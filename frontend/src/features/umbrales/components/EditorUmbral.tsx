import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FilterableSelect,
  FilterableField,
} from '@/shared/components/FilterableSelect';
import {
  apiUmbrales,
  type LightRef,
  type UmbralFenomeno,
} from '@/services/apiUmbrales';
import { apiPlaces, type BackendDistrict } from '@/services/apiPlaces';
import {
  ORDEN_CATEGORIAS,
  construirSlots,
  type SlotLadder,
} from '@/features/umbrales/continuous-validation';

/**
 * EditorUmbral — modal de edición de la escalera de umbrales de un
 * (distrito + fenómeno + variable).
 *
 * A diferencia del editor anterior (1 row por modal), ahora expone la
 * escalera COMPLETA de las 4 categorías en orden fijo:
 *
 *   Moderadamente Lluvioso → Lluvioso → Muy Lluvioso → Extremadamente Lluvioso
 *
 * Concepto: el usuario sólo define "cortes" entre categorías consecutivas,
 * no min/max sueltos por fila. El sistema reconstruye los min/max de cada
 * registro a partir de los cortes:
 *
 *   piso (Mod)   → input aparte (opcional, default 0 mm/h — varia por distrito)
 *   corte 1      → max_value del Mod == min_value del Llu
 *   corte 2      → max_value del Llu == min_value del Muy
 *   corte 3      → max_value del Muy == min_value del Ext
 *   techo (Ext)  → always null (sin techo, el backend lo impone)
 *
 * Cada slot puede estar "registrado" (con id existente) o "sin registrar"
 * (vacío); al guardar, el backend bulk crea / actualiza / elimina atómicamente.
 *
 * El POST/PATCH envía la lista completa al endpoint `bulk/` con `force=true`
 * la primera vez (para sanear BDs antiguas inconsistentes), o `force=false`
 * en ediciones posteriores (verifica el estado previo).
 *
 * Contrato backend:
 *   POST/PATCH /api/v1/core_predictive/thresholds-natural-phenomenas/bulk/
 */
interface EditorUmbralProps {
  open: boolean;
  /** Modo del modal: 'editar' regenera la escalera ya registrada del combo
   *  pre-seleccionado; 'agregar' permite definir un combo nuevo. */
  mode: 'editar' | 'agregar';
  /** Pool de TODOS los umbrales cargados (para validar/describir hermanos). */
  siblingsPool?: UmbralFenomeno[];
  /** Distrito pre-seleccionado (ubigeo). En modo editar obligatorio. */
  defaultDistrictUbigeo?: string;
  /** En modo editar: id del fenómeno natural a precargar (no editable). */
  defaultNaturalPhenomenaId?: number;
  /** En modo editar: id de la variable a precargar (no editable). */
  defaultVariableId?: number;
  onClose: () => void;
  /** Devuelve la lista COMPLETA de filas resultantes del bulk. */
  onSaved: (rows: UmbralFenomeno[]) => void;
}

type Opcion = { value: string; label: string };

function toOpcion(r: LightRef): Opcion {
  return { value: String(r.id), label: r.name };
}

export function EditorUmbral({
  open,
  mode,
  siblingsPool,
  defaultDistrictUbigeo,
  defaultNaturalPhenomenaId,
  defaultVariableId,
  onClose,
  onSaved,
}: EditorUmbralProps) {
  const esEditar = mode === 'editar';
  const [naturalPhenomenaOptions, setNaturalPhenomenaOptions] = useState<Opcion[]>([]);
  const [variableOptions, setVariableOptions] = useState<Opcion[]>([]);
  const [thresholdOptions, setThresholdOptions] = useState<Opcion[]>([]);
  const [districtOptions, setDistrictOptions] = useState<BackendDistrict[]>([]);

  const [naturalPhenomenaId, setNaturalPhenomenaId] = useState<string>('');
  const [variableId, setVariableId] = useState<string>('');
  const [districtUbigeo, setDistrictUbigeo] = useState<string>('');

  /**
   * Slots de la escalera: 4 entradas en orden de severidad. Cada slot tiene
   * `corte` = el max_value que separa este slot del siguiente (o null si es
   * el último o si el slot está "sin registrar" sin valor definido). El
   * `piso` (min_value del primer slot registrado) se guarda aparte en
   * `pisoInferior`.
   *
   * Edición de slots:
   *  - Para slot registrado: se puede vaciar (lo elimina) o rellenar el corte.
   *  - Para slot vacío: se puede habilitar rellenando su corte (se crea en el guardado).
   *  - El último slot (Ext) NO lleva corte (max_value = null fijo).
   */
  const [cortes, setCortes] = useState<(string | null)[]>(['', '', '', '']);
  /** Piso de la categoría inferior (min_value del primer slot registrado). */
  const [pisoInferior, setPisoInferior] = useState<string>('');

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  // Cargar catálogos al abrir.
  useEffect(() => {
    if (!open) return;
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

  // Reset y precarga al abrir.
  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect -- reset de formulario
       al abrir el modal (patrón canónico para modales). */
    setError(null);
    setNaturalPhenomenaId(defaultNaturalPhenomenaId ? String(defaultNaturalPhenomenaId) : '');
    setVariableId(defaultVariableId ? String(defaultVariableId) : '');
    setDistrictUbigeo(defaultDistrictUbigeo ?? '');
    setCortes(['', '', '', '']);
    setPisoInferior('');
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, defaultDistrictUbigeo, defaultNaturalPhenomenaId, defaultVariableId]);

  // Precarga la escalera cuando el usuario completa (np, var, distrito) y/o
  // cambia la selección: inyecta los cortes actuales del distrito en los slots.
  const slots = useMemo<SlotLadder[] | null>(() => {
    if (!naturalPhenomenaId || !variableId || !districtUbigeo) return null;
    if (!siblingsPool || siblingsPool.length === 0) return null;
    const categoriasCatalogo = thresholdOptions.map((o) => ({
      id: Number(o.value),
      name: o.label,
    }));
    if (categoriasCatalogo.length === 0) return null;
    return construirSlots(
      siblingsPool,
      districtUbigeo,
      Number(naturalPhenomenaId),
      Number(variableId),
      categoriasCatalogo,
    );
  }, [naturalPhenomenaId, variableId, districtUbigeo, siblingsPool, thresholdOptions]);

  // Cuando slots cambia, precargar cortes y piso con los valores actuales.
  useEffect(() => {
    if (!slots) return;
    /* eslint-disable react-hooks/set-state-in-effect -- precarga de cortes
       actuales al calcular los slots subyacentes (one-shot). */
    const nuevosCortes: (string | null)[] = ORDEN_CATEGORIAS.map((_, idx) => {
      const s = slots[idx];
      // El último slot (Ext) NO lleva corte → null fijo.
      if (idx === ORDEN_CATEGORIAS.length - 1) return null;
      if (s.vacio) return '';
      return s.max_value === null ? '' : String(s.max_value);
    });
    setCortes(nuevosCortes);
    // Piso: el min_value del primer slot registrado.
    const primeroRegistrado = slots.find((s) => !s.vacio);
    setPisoInferior(
      primeroRegistrado && primeroRegistrado.min_value !== null
        ? String(primeroRegistrado.min_value)
        : '',
    );
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [slots]);

  if (!open) return null;

  /**
   * Reconstruye los items a partir de slots + cortes + piso.
   *
   * Invariante: si un slot intermedio está vacío y sus vecinos están
   * presentes, el corte del vecino inferior se promueve al siguiente slot
   * presente (su min_value continúa siendo el corte anterior). El backend
   * luego valida la coherencia del ladder resultante.
   */
  function buildItems(): { items: Array<{ id?: number; threshold: number; min_value: number | null; max_value: number | null }>; force: boolean; errores: string[] } {
    const errores: string[] = [];
    if (!slots) {
      return { items: [], force: false, errores: ['Primero elija distrito, fenómeno y variable.'] };
    }

    // Slots presentes (con corte o registrados). El Ext sólo se incluye si ya
    // está registrado o si su vecino anterior está presente (su min derivará
    // del corte anterior).
    const items: Array<{ id?: number; threshold: number; min_value: number | null; max_value: number | null }> = [];

    // Recoger pisos y cortes (numéricos, null si vacíos).
    const pisoNum = pisoInferior.trim() === '' ? null : Number(pisoInferior);
    if (pisoNum !== null && Number.isNaN(pisoNum)) errores.push('El piso inferior no es numérico.');
    if (pisoNum !== null && pisoNum < 0) errores.push('El piso inferior no puede ser negativo.');

    const cortesNum: (number | null)[] = cortes.map((c, idx) => {
      // El último slot (Ext) siempre tiene corte = null (sin techo fijo).
      if (idx === ORDEN_CATEGORIAS.length - 1) return null;
      if (c === null || c === '' || c === undefined) return null;
      const n = Number(c);
      if (Number.isNaN(n)) return null;
      return n;
    });

    // Validar cortes crecientes estrictos entre los presentes.
    const cortesPresentes = cortesNum.filter((c) => c !== null) as number[];
    for (let i = 1; i < cortesPresentes.length; i++) {
      if (cortesPresentes[i - 1] >= cortesPresentes[i]) {
        errores.push(
          `Los cortes deben ser estrictamente crecientes: ${cortesPresentes[i - 1]} ≥ ${cortesPresentes[i]}.`,
        );
        break;
      }
    }

    // Construir items recorriendo slots en orden de severidad.
    // "SiguiendoCorte" almacena el último corte definido a la izquierda de
    // un slot vacío (su min_value se propagará al siguiente slot presente).
    let corteAnterior: number | null = null;
    let primerSlotPresente = true;

    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      const esUltimo = i === slots.length - 1;
      const corteActual = cortesNum[i];

      // ¿El slot está presente (registrado o se está llenando con corte)?
      // Un slot se considera "presente" si:
      //  - está registrado (no vacío catálogo previo), o
      //  - tiene un corte definido por el usuario, o
      //  - es el último slot registrado + su corte anterior proviene del vecino.
      const lleno = !s.vacio || corteActual !== null;

      if (!lleno) {
        // Slot vacío y sin corte: lo saltamos (no se incluye en el bulk).
        // El corte anterior (si lo había) se propaga al siguiente presente.
        continue;
      }

      const tienePiso = primerSlotPresente;
      primerSlotPresente = false;

      // min_value:
      let mn: number | null;
      if (tienePiso) {
        // Primer slot presente: usa el piso definido.
        mn = pisoNum;
        if (mn === null) {
          errores.push(`Falta el piso (valor mínimo) de la categoría inferior (“${s.nombre}”).`);
        }
      } else {
        // Slot siguiente: min_value = corte anterior.
        mn = corteAnterior;
        if (mn === null) {
          errores.push(
            `No se puede definir “${s.nombre}” sin un corte desde el slot anterior. ` +
            'Rellene todos los slots intermedios.',
          );
        }
      }

      // max_value:
      let mx: number | null;
      if (esUltimo) {
        // El último slot siempre lleva max_value = null (sin techo).
        mx = null;
      } else {
        mx = corteActual;
        if (mx === null) {
          // El slot presente pero sin corte → su max_value debe ser el
          // corte del siguiente slot presente. Lo dejamos pendiente y se
          // propagará al agregar el siguiente; requerimos que esté definido.
          errores.push(`Falta el corte superior de “${s.nombre}”.`);
        } else {
          corteAnterior = mx;
        }
      }

      if (s.thresholdId === null) {
        errores.push(`No se pudo resolver el threshold id de “${s.nombre}”.`);
        continue;
      }

      items.push({
        id: s.id,
        threshold: s.thresholdId,
        min_value: mn,
        max_value: mx,
      });
    }

    if (items.length === 0) {
      errores.push('Defina al menos una categoría con su corte.');
    }

    // force=true: saltamos la verificación de "estado previo" del backend,
    // útil para normalizar BDs antiguas inconsistentes. Siempre validamos la
    // coherencia del resultado (cortes crecientes).
    const force = true;

    return { items, force, errores };
  }

  async function handleGuardar() {
    const { items, force, errores } = buildItems();
    if (errores.length > 0) {
      setError(errores.join(' '));
      return;
    }
    if (!naturalPhenomenaId || !variableId || !districtUbigeo) {
      setError('Fenómeno, variable y distrito son obligatorios.');
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      const rows = await apiUmbrales.bulkSave({
        natural_phenomena: Number(naturalPhenomenaId),
        variable: Number(variableId),
        district: districtUbigeo,
        force,
        items,
      });
      onSaved(rows);
      onClose();
    } catch (err: unknown) {
      setError(extraerError(err));
    } finally {
      setGuardando(false);
    }
  }

  function handleCorteChange(idx: number, valor: string) {
    setCortes((prev) => {
      const next = [...prev];
      next[idx] = valor;
      return next;
    });
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !guardando) onClose();
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
          {esEditar ? 'Editar Umbrales del Distrito' : 'Agregar Umbrales a un Distrito'}
        </h2>

        <p className="text-text-secondary text-xs font-sans">
          {esEditar
            ? 'Edita los cortes de las categorías ya registradas. La categoría superior (Extremadamente Lluvioso) siempre queda sin techo.'
            : 'Define los cortes entre categorías consecutivas. La categoría superior (Extremadamente Lluvioso) siempre queda sin techo. Las categorías intermedias no registradas se pueden omitir dejando el corte vacío.'}
        </p>

        <div className="grid grid-cols-3 gap-4">
          <FilterableField label="Fenómeno Natural" required>
            <FilterableSelect
              value={naturalPhenomenaId}
              onChange={setNaturalPhenomenaId}
              options={naturalPhenomenaOptions}
              placeholder="Buscar fenómeno…"
              emptyLabel="— Seleccionar fenómeno —"
              disabled={esEditar}
            />
          </FilterableField>

          <FilterableField label="Variable" required>
            <FilterableSelect
              value={variableId}
              onChange={setVariableId}
              options={variableOptions}
              placeholder="Buscar variable…"
              emptyLabel="— Seleccionar variable —"
              disabled={esEditar}
            />
          </FilterableField>

          <FilterableField label="Distrito (Unidad Operativa)" required>
            <FilterableSelect
              value={districtUbigeo}
              onChange={setDistrictUbigeo}
              options={districtOptions.map((d) => ({ value: d.ubigeo, label: d.name }))}
              placeholder="Buscar distrito…"
              emptyLabel="— Seleccionar distrito —"
              disabled={esEditar}
            />
          </FilterableField>
        </div>

        {/* ── Escalera de cortes ── */}
        {slots ? (
          <div className="flex flex-col gap-3">
            {/* Piso inferior (sólo del primer slot registrado/presente). */}
            <div className="flex items-center gap-3">
              <span className="w-44 text-sm font-sans text-text-primary">
                Piso inferior (mm/h):
              </span>
              <input
                type="number"
                step="any"
                value={pisoInferior}
                onChange={(e) => setPisoInferior(e.target.value)}
                placeholder="Ej. 1.6 (puede variar por distrito)"
                className="flex-1 bg-background-main rounded-xl outline outline-1 outline-offset-[-1px] outline-button-stroke px-4 py-2.5 text-text-primary text-sm font-sans focus:outline-2 focus:outline-primary-main"
              />
            </div>

            {/* Cortes entre categorías consecutivas. */}
            {ORDEN_CATEGORIAS.map((nombre, idx) => {
              const s = slots[idx];
              const esUltimo = idx === ORDEN_CATEGORIAS.length - 1;
              // En modo editar: slot NO registrado → no editable, se omite
              // visualmente con etiqueta "sin registrar". En modo agregar:
              // se muestra el input vacío para que el usuario defina el corte.
              const slotEditable = !esUltimo && (!esEditar || !s.vacio);
              return (
                <div key={nombre} className="flex items-center gap-3">
                  <span className="w-44 text-sm font-sans text-text-primary">
                    {nombre}
                    {s.vacio ? (
                      <span className="ml-2 text-xs text-text-secondary">(sin registrar)</span>
                    ) : (
                      <span className="ml-2 text-xs text-text-secondary">(registrado)</span>
                    )}
                  </span>
                  {esUltimo ? (
                    <span className="flex-1 text-sm font-sans text-text-secondary italic">
                      Sin techo (null)
                    </span>
                  ) : slotEditable ? (
                    <input
                      type="number"
                      step="any"
                      value={cortes[idx] ?? ''}
                      onChange={(e) => handleCorteChange(idx, e.target.value)}
                      placeholder={`Corte ${nombre} → ${ORDEN_CATEGORIAS[idx + 1]}`}
                      className="flex-1 bg-background-main rounded-xl outline outline-1 outline-offset-[-1px] outline-button-stroke px-4 py-2.5 text-text-primary text-sm font-sans focus:outline-2 focus:outline-primary-main"
                    />
                  ) : (
                    <span className="flex-1 text-sm font-sans text-text-secondary italic">
                      {esEditar ? 'No registrada (use Agregar umbral)' : '—'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm font-sans text-text-secondary">
            {esEditar
              ? 'Cargando escalera registrada…'
              : 'Seleccione fenómeno, variable y distrito para definir la escalera.'}
          </p>
        )}

        {error && (
          <p className="text-red-600 text-sm font-sans" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end items-center gap-3">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onClose}
            disabled={guardando}
            className="px-5 py-2.5 rounded-xl outline outline-1 outline-offset-[-1px] outline-button-stroke text-text-primary text-sm font-medium font-sans
                       hover:bg-primary-states-hover-main/30 transition-colors
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleGuardar}
            disabled={guardando || !slots}
            className="px-5 py-2.5 rounded-xl bg-primary-main text-text-invert-primary text-sm font-medium font-sans
                       hover:bg-primary-light transition-colors
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {guardando ? 'Guardando…' : 'Guardar Escalera'}
          </button>
        </div>
      </div>
    </div>
  );
}

function extraerError(err: unknown): string {
  const e = err as { response?: { data?: Record<string, unknown> | string } };
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
  if (typeof data === 'string') return data;
  return 'Error al guardar la escalera.';
}

function describirError(err: unknown): string {
  const e = err as { response?: { status?: number; statusText?: string } };
  const status = e?.response?.status;
  if (typeof status === 'number') {
    return `HTTP ${status}${e?.response?.statusText ? ' ' + e.response.statusText : ''}`;
  }
  return 'sin respuesta';
}
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Download,
  FileJson,
  FileSpreadsheet,
  Upload,
  X,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { apiComponentes, type ImportResult } from '@/services/apiComponentes';

type Formato = 'csv' | 'geojson' | 'xlsx';
type Step = 'format' | 'upload' | 'preview' | 'result' | 'error';

const CSV_HEADERS = [
  'code',
  'name',
  'type',
  'district_ubigeo',
  'criticality',
  'easting',
  'northing',
];
const CSV_OPTIONAL = [
  'operational_status',
  'physical_status',
  'specification',
];
const CSV_SAMPLE_ROWS = [
  // code, name, type, district_ubigeo, criticality, easting, northing,
  // operational_status (optional), physical_status (optional),
  // specification (optional; dejar '' para null).
  ['CPT-001', 'Captación Río Pichanaqui', 'CAPTACIÓN', '120303', 'ALTA', '463529', '8777285', '001', 'A', 'Captación superficial del río'],
  ['RES-002', 'Reservorio San Ramón', 'RESERVORIO', '120305', 'MEDIA', '465120', '8779850', '001', 'B', 'Reservorio apoyado 50 m3'],
  // Ejemplo con specification vacía (null en backend).
  ['EBB-004', 'Estación Bombeo Satipo', 'ESTACIÓN DE BOMBEO Y REBOMBEO DE AGUA POTABLE', '120601', 'ALTA', '471200', '8780050', '002', 'C', ''],
  // Línea con varios vértices: 2 filas con mismo `code`.
  ['LDC-003', 'Línea Conducción Tramo 1', 'LÍNEA DE CONDUCCIÓN', '120303', 'ALTA', '463600', '8777300', '001', 'A', 'Tramo entre captación y planta'],
  ['LDC-003', 'Línea Conducción Tramo 1', 'LÍNEA DE CONDUCCIÓN', '120303', 'MEDIA', '463700', '8777350', '001', 'A', 'Tramo entre captación y planta'],
];

const GEOJSON_SAMPLE = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      // Geometry puede ser null (o cualquier placeholder) si usás UTM
      // arrays en properties; el parser prefiere UTM si está.
      geometry: null,
      properties: {
        code: 'CPT-001',
        name: 'Captación Río Pichanaqui',
        type: 'CAPTACIÓN',
        district_ubigeo: '120303',
        criticality: 'ALTA',
        operational_status: '001',
        physical_status: 'A',
        specification: 'Captación superficial del río',
        // UTM obligatorio: arrays paralelos Este / Norte.
        utm_eastings: [463529],
        utm_northings: [8777285],
        utm_zone: 18,
      },
    },
    {
      type: 'Feature',
      geometry: null,
      properties: {
        code: 'LDC-003',
        name: 'Línea Conducción Tramo 1',
        type: 'LÍNEA DE CONDUCCIÓN',
        district_ubigeo: '120303',
        criticality: 'ALTA',
        operational_status: '001',
        physical_status: 'A',
        specification: 'Tramo entre captación y planta',
        // 3 vértices: arrays paralelos. La criticidad es la misma para
        // todos los vértices (propiedad `criticality`); si querés
        // criticidad por vértice, dividí el componente en varios features
        // con mismo `code` o usá CSV (que lo permite nativamente).
        utm_eastings: [463600, 463700, 463800],
        utm_northings: [8777300, 8777350, 8777400],
        utm_zone: 18,
      },
    },
  ],
} as const;

interface CargarDatosModalProps {
  open: boolean;
  /** Formato preseleccionado por el dropdown ('Csv' / 'GeoJson'). */
  initialFormat?: 'Excel' | 'Csv' | 'GeoJson';
  onClose: () => void;
  /** Callback opcional tras importar exitosamente (ej. refetch). */
  onImported?: () => void;
}

/**
 * CargarDatosModal — modal standalone de 4 pasos para importar
 * componentes desde CSV o GeoJSON. Estrategia backend dry_run:
 *
 *   1. Formato  → elegir CSV / GeoJSON (preseleccionado si vino del
 *      dropdown del TopBar).
 *   2. Upload   → dropzone + descarga de plantilla + criterios. Al
 *      soltar el archivo se dispara `dry_run=true` y se válida en
 *      backend sin persistir.
 *   3. Preview  → "N componentes · 0 errores" + botón "Importar N".
 *      Si el dry_run reporta errores, se salta directamente a la etapa
 *      `error` con la lista detallada.
 *   4. Result   → "N componentes creados" + botón "Ver en Gestión".
 *
 * `error` se renderiza como etapa aparte (banner rojo + lista de
 * errores fila/feature + "Volver a subir"). En cualquier momento:
 * Escape, clic fuera, o botón X cierran el modal.
 *
 * El modal es **standalone**: NO reciclamos `ConfirmDialog` (su tarjeta
 * es `max-w-md` y no soporta contenido mido de wizard + lists
 * con scroll interno).
 */
export function CargarDatosModal({
  open,
  initialFormat,
  onClose,
  onImported,
}: CargarDatosModalProps) {
  const navigate = useNavigate();
  const [format, setFormat] = useState<Formato>(
    initialFormat === 'GeoJson' ? 'geojson'
      : initialFormat === 'Excel' ? 'xlsx'
      : 'csv',
  );
  const [step, setStep] = useState<Step>('format');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset al abrir/cerrar.
  useEffect(() => {
    if (open) {
      setFormat(
      initialFormat === 'GeoJson' ? 'geojson'
        : initialFormat === 'Excel' ? 'xlsx'
        : 'csv',
    );
      setStep(initialFormat ? 'upload' : 'format');
      setFile(null);
      setResult(null);
      setServerError(null);
      setLoading(false);
      setDragOver(false);
    }
  }, [open, initialFormat]);

  // Escape para cerrar.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  function handleClose() {
    onClose();
  }

  function handleSelectFormat(f: Formato) {
    setFormat(f);
    setStep('upload');
  }

  function handleDownloadPlantilla() {
    // XLSX (Excel): el backend genera la plantilla con descripciones,
    // dropdowns y filas de ejemplo. La descargamos como Blob HTTP.
    if (format === 'xlsx') {
      apiComponentes
        .downloadXlsxTemplate()
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'plantilla_componentes.xlsx';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        })
        .catch((err) => {
          setServerError(
            err?.response?.data?.error ||
              err?.message ||
              'Error al descargar la plantilla Excel.',
          );
        });
      return;
    }

    // CSV / GeoJSON: generados en el cliente desde una constante.
    let blob: Blob;
    let filename: string;
    if (format === 'csv') {
      // BOM UTF-8 (\uFEFF) para que Excel detecte el encoding correcto
      // y muestre tildes/ñ sin mojibake. Sin esto, Excel abre el CSV
      // con CP1252 y los caracteres no-ASCII se ven mal (CÃ³digo en
      // lugar de Código, etc.).
      const lines = [
        [...CSV_HEADERS, ...CSV_OPTIONAL].join(','),
        ...CSV_SAMPLE_ROWS.map((r) => r.join(',')),
      ];
      blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      filename = 'plantilla_componentes.csv';
    } else {
      blob = new Blob(['\uFEFF' + JSON.stringify(GEOJSON_SAMPLE, null, 2)], {
        type: 'application/geo+json;charset=utf-8',
      });
      filename = 'plantilla_componentes.geojson';
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handlePickFile(f: File) {
    setFile(f);
    setResult(null);
    setServerError(null);
    setLoading(true);
    const api = getImportApi(format);
    api(f, true)
      .then((r) => {
        setResult(r);
        setStep(r.errors.length > 0 ? 'error' : 'preview');
      })
      .catch((err) => {
        setServerError(
          err?.response?.data?.error ||
            err?.message ||
            'Error al validar el archivo.',
        );
        setStep('error');
      })
      .finally(() => setLoading(false));
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handlePickFile(f);
  }

  function handleConfirmImport() {
    if (!file) return;
    setLoading(true);
    const api = getImportApi(format);
    api(file, false)
      .then((r) => {
        if (r.errors.length > 0) {
          setResult(r);
          setStep('error');
        } else {
          setResult(r);
          setStep('result');
          onImported?.();
        }
      })
      .catch((err) => {
        setServerError(
          err?.response?.data?.error ||
            err?.message ||
            'Error al importar el archivo.',
        );
        setStep('error');
      })
      .finally(() => setLoading(false));
  }

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cargar-datos-title"
        className={cn(
          'w-[46rem] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)]',
          'bg-background-main rounded-section shadow-[0px_8px_24px_0px_rgba(0,0,0,0.30)]',
          'flex flex-col overflow-hidden',
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-input-stroke-main shrink-0">
          <div className="flex flex-col gap-0.5">
            <h2
              id="cargar-datos-title"
              className="text-text-primary text-xl font-bold font-sans leading-6"
            >
              Cargar Componentes
            </h2>
            <StepBreadcrumb step={step} format={format} />
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Cerrar"
            className="size-9 inline-flex items-center justify-center rounded-lg
                       outline outline-1 outline-offset-[-1px] outline-input-stroke-main
                       text-text-secondary hover:bg-primary-states-hover-main/30
                       hover:text-text-primary transition-colors shrink-0"
          >
            <X className="size-5" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        {/* Cuerpo scrolleable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5 min-h-0">
          {/* ─── Step 1: Formato ─── */}
          {step === 'format' && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-text-secondary font-sans">
                Elegí el formato del archivo que querés cargar:
              </p>
              <div className="grid grid-cols-3 gap-4">
                <FormatCard
                  active={format === 'xlsx'}
                  onClick={() => handleSelectFormat('xlsx')}
                  icon={<FileSpreadsheet className="size-8 text-primary-main" />}
                  title="Excel"
                  desc="Tabla con descripciones por columna y dropdowns de valores válidos. Recomendado."
                />
                <FormatCard
                  active={format === 'csv'}
                  onClick={() => handleSelectFormat('csv')}
                  icon={<FileSpreadsheet className="size-8 text-primary-main" />}
                  title="CSV"
                  desc="Puntos y líneas con 1 fila por vértice. Ideal para lotes tabulares."
                />
                <FormatCard
                  active={format === 'geojson'}
                  onClick={() => handleSelectFormat('geojson')}
                  icon={<FileJson className="size-8 text-primary-main" />}
                  title="GeoJSON"
                  desc="Geometría nativa Point/LineString. Para SIG / QGIS."
                />
              </div>
            </div>
          )}

          {/* ─── Steps 2-4 (post-formato) ─── */}
          {step !== 'format' && (
            <>
              {/* Chip de formato seleccionado + cambiar */}
              <div className="flex items-center gap-2 text-sm font-sans">
                <span className="text-text-secondary">Formato:</span>
                <span className="px-2 py-0.5 rounded-md bg-primary-main text-text-invert-primary text-xs font-bold uppercase">
                  {format}
                </span>
                <button
                  type="button"
                  onClick={() => setStep('format')}
                  className="text-primary-main text-xs font-medium hover:underline ml-2"
                >
                  Cambiar
                </button>
              </div>

              {/* Step 2 — Upload + criterios + plantilla + dropzone */}
              {step === 'upload' && (
                <div className="flex flex-col gap-4">
                  <CriteriosBlock format={format} />
                  <button
                    type="button"
                    onClick={handleDownloadPlantilla}
                    className="inline-flex items-center gap-2 self-start px-3 py-1.5 rounded-lg
                               outline outline-1 outline-offset-[-1px] outline-primary-main
                               text-primary-main text-sm font-medium font-sans
                               hover:bg-primary-main/10 transition-colors"
                  >
                    <Download className="size-4" strokeWidth={2} aria-hidden="true" />
                    Descargar plantilla
                  </button>

                  {/* Dropzone */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current?.click()}
                    className={cn(
                      'border-2 border-dashed rounded-xl py-12 px-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors',
                      dragOver
                        ? 'border-primary-main bg-primary-main/10'
                        : 'border-input-stroke-main hover:border-primary-main hover:bg-primary-states-hover-main/10',
                    )}
                  >
                    <Upload className="size-9 text-text-secondary" strokeWidth={1.5} aria-hidden="true" />
                    <p className="text-text-primary text-sm font-semibold font-sans">
                      Arrastrá el archivo acá o hacé clic
                    </p>
                    <span className="text-text-secondary text-xs font-sans">
                      {format === 'csv'
                        ? '.csv (UTF-8)'
                        : format === 'xlsx'
                          ? '.xlsx (Excel)'
                          : '.geojson / .json'}
                    </span>
                    <input
                      ref={inputRef}
                      type="file"
                      accept={
                        format === 'csv'
                          ? '.csv,text/csv'
                          : format === 'xlsx'
                            ? '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel'
                            : '.geojson,.json,application/geo+json,application/json'
                      }
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handlePickFile(f);
                      }}
                    />
                  </div>

                  {loading && (
                    <div className="flex items-center gap-2 text-text-secondary text-sm font-sans">
                      <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
                      Validando archivo…
                    </div>
                  )}
                </div>
              )}

              {/* Step 3 — Preview */}
              {step === 'preview' && file && result && (
                <PreviewBlock result={result} file={file} />
              )}

              {/* Step 4 — Result */}
              {step === 'result' && result && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <CheckCircle2 className="size-16 text-success-main" strokeWidth={1.5} aria-hidden="true" />
                  <p className="text-text-primary text-lg font-bold font-sans text-center">
                    {result.created} componente{result.created === 1 ? '' : 's'} creado{result.created === 1 ? '' : 's'} correctamente
                  </p>
                  <span className="text-text-secondary text-sm font-sans text-center">
                    La base de datos fue actualizada. Podés verlos en la página de Gestión.
                  </span>
                </div>
              )}

              {/* Step Error (validación o import) */}
              {step === 'error' && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-danger-states-hover/40 border border-danger-light">
                    <AlertTriangle className="size-5 text-danger-main mt-0.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                    <div className="flex flex-col gap-1">
                      <span className="text-danger-dark text-sm font-bold font-sans">
                        Se encontraron errores. La importación fue abortada.
                      </span>
                      <span className="text-danger-dark text-xs font-sans">
                        Corregí los errores en el archivo y volvé a subirlo. No se creó ningún componente.
                      </span>
                    </div>
                  </div>

                  {serverError && (
                    <p className="text-danger-dark text-sm font-sans px-1">{serverError}</p>
                  )}

                  {result && result.errors.length > 0 && (
                    <div className="flex flex-col max-h-64 overflow-y-auto border border-input-stroke-main rounded-lg">
                      {result.errors.map((e, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 px-4 py-2.5 border-b border-input-stroke-main last:border-b-0 bg-danger-states-hover/20"
                        >
                          <span className="size-6 inline-flex items-center justify-center rounded-full bg-danger-main text-text-invert-primary text-xs font-bold shrink-0">
                            {e.row ?? '—'}
                          </span>
                          <div className="flex flex-col gap-0.5 min-w-0">
                            {e.code && (
                              <span className="text-text-primary text-xs font-bold font-sans">
                                {e.code}
                              </span>
                            )}
                            <span className="text-text-primary text-sm font-sans break-words">
                              {e.message}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer con acciones por paso */}
        <div className="px-6 py-4 border-t border-input-stroke-main flex items-center justify-end gap-2 shrink-0">
          {/* Step upload */}
          {step === 'upload' && (
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-lg outline outline-1 outline-offset-[-1px] outline-button-stroke
                         text-text-primary text-sm font-medium font-sans
                         hover:bg-primary-states-hover-main/30 transition-colors"
            >
              Cancelar
            </button>
          )}

          {/* Step preview */}
          {step === 'preview' && file && result && (
            <>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setResult(null);
                  setStep('upload');
                }}
                className="px-4 py-2 rounded-lg outline outline-1 outline-offset-[-1px] outline-button-stroke
                           text-text-primary text-sm font-medium font-sans
                           hover:bg-primary-states-hover-main/30 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={loading}
                className="px-5 py-2 rounded-lg bg-primary-main text-text-invert-primary text-sm font-bold font-sans
                           hover:bg-primary-light transition-colors
                           disabled:opacity-60 disabled:cursor-not-allowed
                           inline-flex items-center gap-2"
              >
                {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {loading
                  ? 'Importando…'
                  : `Importar ${result.preview_count ?? result.created} componente${(result.preview_count ?? result.created) === 1 ? '' : 's'}`}
              </button>
            </>
          )}

          {/* Step result */}
          {step === 'result' && (
            <button
              type="button"
              onClick={() => {
                handleClose();
                navigate('/componentes/gestion');
              }}
              className="px-5 py-2 rounded-lg bg-primary-main text-text-invert-primary text-sm font-medium font-sans
                         hover:bg-primary-light transition-colors"
            >
              Ver en Gestión
            </button>
          )}

          {/* Step error */}
          {step === 'error' && (
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setResult(null);
                setServerError(null);
                setStep('upload');
              }}
              className="px-5 py-2 rounded-lg bg-primary-main text-text-invert-primary text-sm font-bold font-sans
                         hover:bg-primary-light transition-colors"
            >
              Volver a subir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Subcomponentes ────────────────────────────────────────────────────

/** Elige el service de importación según el formato elegido. */
function getImportApi(format: Formato) {
  if (format === 'csv') return apiComponentes.importCsv;
  if (format === 'xlsx') return apiComponentes.importXlsx;
  return apiComponentes.importGeojson;
}

function StepBreadcrumb({ step, format }: { step: Step; format: Formato }) {
  // Etiquetas legibles por paso para el sub-encabezado.
  const labels: Record<Step, string> = {
    format: 'Paso 1 — Elegir formato',
    upload: `Paso 2 — Cargar archivo ${format.toUpperCase()}`,
    preview: 'Paso 3 — Verificación',
    error: 'Errores — Revisar y corregir',
    result: 'Paso 4 — Carga completa',
  };
  return (
    <span className="text-text-secondary text-xs font-sans uppercase tracking-wide">
      {labels[step]}
    </span>
  );
}

function FormatCard({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-3 p-5 rounded-xl border-2 text-left transition-colors',
        active
          ? 'border-primary-main bg-primary-main/5'
          : 'border-input-stroke-main hover:border-primary-main hover:bg-primary-states-hover-main/10',
      )}
    >
      {icon}
      <span className="text-text-primary text-base font-bold font-sans">{title}</span>
      <span className="text-text-secondary text-xs font-sans leading-relaxed">{desc}</span>
    </button>
  );
}

function CriteriosBlock({ format }: { format: Formato }) {
  if (format === 'xlsx') {
    return (
      <div className="flex flex-col gap-2 p-4 rounded-lg bg-primary-main/5 border border-input-stroke-main">
        <span className="text-text-primary text-sm font-bold font-sans">
          Criterios del Excel
        </span>
        <ul className="text-text-secondary text-xs font-sans list-disc list-inside flex flex-col gap-1 leading-relaxed">
          <li>Descargá la <strong>plantilla</strong> — ya tiene descripción por columna, dropdowns con los valores válidos (tipo, criticidad, estados) y filas de ejemplo.</li>
          <li>Mantené la fila de headers (navy) tal cual.</li>
          <li>Borrá las filas con <code>code = ELIMINAR</code> antes de subir (son ejemplos; el parser también las saltea automáticamente, pero queda más limpio).</li>
          <li>Completá UNA fila por componente. Para líneas (LÍNEA DE CONDUCCIÓN / ADUCCIÓN): repetí el <code>code</code> en N filas, una por vértice.</li>
          <li>Usá los <strong>dropdowns</strong> en <code>type</code>, <code>criticality</code>, <code>operational_status</code> y <code>physical_status</code> para evitar errores de tipeo.</li>
          <li>Consultá la hoja <strong>"Valores"</strong> del mismo archivo para conocer los tipos / criticidades / estados disponibles y sus códigos.</li>
          <li><code>specification</code> puede quedar vacío (= NULL en la DB).</li>
          <li>Encoding UTF-8 nativo de .xlsx (tildes y ñ no son problema).</li>
        </ul>
      </div>
    );
  }
  if (format === 'csv') {
    return (
      <div className="flex flex-col gap-2 p-4 rounded-lg bg-primary-main/5 border border-input-stroke-main">
        <span className="text-text-primary text-sm font-bold font-sans">
          Criterios del CSV
        </span>
        <ul className="text-text-secondary text-xs font-sans list-disc list-inside flex flex-col gap-1 leading-relaxed">
          <li>Columnas obligatorias: <code className="text-primary-main">{CSV_HEADERS.join(', ')}</code></li>
          <li>Opcionales: <code>{CSV_OPTIONAL.join(', ')}</code></li>
          <li>Encoding UTF-8. Valores separados por coma.</li>
          <li><strong>Líneas</strong>: repetí el <code>code</code> en N filas, una por vértice. El <code>type</code> debe ser <code>LÍNEA DE CONDUCCIÓN</code> o <code>LÍNEA DE ADUCCIÓN</code>.</li>
          <li><code>type</code> y <code>criticality</code> por nombre (ej. "CAPTACIÓN", "ALTA").</li>
          <li><code>district_ubigeo</code> ubigeo del distrito (ej. "120303").</li>
        </ul>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 p-4 rounded-lg bg-primary-main/5 border border-input-stroke-main">
      <span className="text-text-primary text-sm font-bold font-sans">
        Criterios del GeoJSON
      </span>
      <ul className="text-text-secondary text-xs font-sans list-disc list-inside flex flex-col gap-1 leading-relaxed">
        <li>Raíz: <code>FeatureCollection</code>. Cada <code>Feature</code> = un componente.</li>
        <li>Properties obligatorias: <code>code</code>, <code>name</code>, <code>type</code>, <code>district_ubigeo</code>, <code>criticality</code>, y <strong>UTM arrays</strong>: <code>utm_eastings</code>, <code>utm_northings</code> (paralelos, en metros).</li>
        <li>Opcionales: <code>operational_status</code> (código), <code>physical_status</code> (código), <code>specification</code>, <code>utm_zone</code> (default 18).</li>
        <li>UTM es la <strong>unidad principal</strong>. Si properties trae <code>utm_eastings</code>/<code>utm_northings</code>, se usan esos arrays (1 = puntual; 2+ = línea).</li>
        <li>Alternativa (fallback): si NO trae UTM arrays, usar <code>geometry.coordinates</code> estándar GeoJSON (<code>[lng, lat]</code> WGS84) con type <code>Point</code> / <code>LineString</code> / <code>MultiPoint</code>.</li>
        <li><code>type</code> y <code>criticality</code> por nombre. Para varios vértices, todos comparten la misma <code>criticality</code> de properties; si querés criticidad por vértice, usá CSV.</li>
        <li><code>specification</code> se puede omitir o dejar vacío (<code>""</code> / <code>null</code>) — el backend lo persiste como null.</li>
      </ul>
    </div>
  );
}

function PreviewBlock({ result, file }: { result: ImportResult; file: File }) {
  const previewCount = result.preview_count ?? result.created;
  return (
    <div className="flex flex-col gap-3 p-5 rounded-lg border border-input-stroke-main bg-background-main">
      <div className="flex items-center gap-2">
        <FileSpreadsheet className="size-5 text-primary-main" aria-hidden="true" />
        <span className="text-text-primary text-sm font-sans font-medium truncate">
          {file.name}
        </span>
        <span className="text-text-secondary text-xs font-sans ml-auto">
          {(file.size / 1024).toFixed(1)} KB
        </span>
      </div>
      <div className="flex items-center gap-6 py-2">
        <div className="flex flex-col">
          <span className="text-success-dark text-3xl font-bold font-sans tabular-nums leading-none">
            {previewCount}
          </span>
          <span className="text-text-secondary text-xs font-sans uppercase mt-1">componentes</span>
        </div>
        <div className="flex flex-col">
          <span className="text-success-dark text-3xl font-bold font-sans tabular-nums leading-none">
            0
          </span>
          <span className="text-text-secondary text-xs font-sans uppercase mt-1">errores</span>
        </div>
      </div>
      <p className="text-text-secondary text-xs font-sans leading-relaxed">
        Todo OK. Al confirmar se crearán <strong className="text-text-primary">{previewCount}</strong> componente{previewCount === 1 ? '' : 's'} en la base de datos.
        La operación es transaccional: si algún componente viola el unique <code>(district + type + code)</code> o falla una FK, no se crea nada.
      </p>
    </div>
  );
}
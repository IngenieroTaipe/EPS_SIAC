import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';

// Iconos de Figma importados como componentes React (vía vite-plugin-svgr).
// Todos estos SVG ya usan `currentColor`, por lo que heredan el color
// (text-text-invert-primary) de las clases Tailwind aplicadas al componente.
//
// Para cambiar un icono concreto:
//   - Edita el nombre del archivo en el import.
//   - No hace falta tocar `topbarConfig.ts` ni `TopBar.tsx`.
import RestartIcon from '@/assets/icons/restart.svg?react';
import AlertIcon from '@/assets/icons/alert.svg?react';
import ArchivoIcon from '@/assets/icons/archivo.svg?react';
import FlechaIcon from '@/assets/icons/flecha.svg?react';
import { useClickOutside } from '@/shared/hooks/useClickOutside';
import { useUnidadOperativa } from '@/shared/context/useUnidadOperativa';
import { CargarDatosModal } from '@/features/componentes/components/CargarDatosModal';
import {
  UNIDADES_OPERATIVAS,
  UNIDAD_TODAS,
} from '@/shared/context/UnidadOperativaContext';
import {
  UPDATED_LABEL_PREFIX,
  UPDATED_VALUE,
  UNIDAD_OPERATIVA_LABEL,
  CARGAR_DATOS_OPTIONS,
} from './TopBarConfig';

/**
 * Widgets del TopBar. Cada widget es independiente y recibe los datos que
 * necesita. Todos usan los tokens de marca (`primary-main`, `primary-light`,
 * `secondary-main`, `text-text-invert-primary`) importados desde
 * `tailwind.config.ts`.
 *
 * Tamaños reducidos según feedback del usuario — ajusta aquí para que todos
 * los widgets compartan escala visual.
 *
 * Si necesitas un widget nuevo:
 *   1. Agrégalo al union type `TopBarWidget` en `TopBarConfig.ts`.
 *   2. Crea el componente aquí.
 *   3. Agrégalo al `switch` en `TopBarWidgets.render.tsx`.
 */

const ICON_SIZE = 'size-5'; // iconos base de widgets (20px)

/**
 * Props del componente `DropdownItem`, reutilizado por ambos dropdowns.
 * El color del fondo y del borde se define desde el padre (según el pallete
 * del dropdown en Figma: "pallete=1" primary-light / "pallete=2" primary-dark).
 */
import { cn } from '@/shared/lib/cn';

interface DropdownItemProps {
  label: string;
  onClick: (label: string) => void;
  /** Fondo del item (sin hover). */
  bgClass: string;
  /** Color del borde. */
  outlineClass: string;
}

function DropdownItem({
  label,
  onClick,
  bgClass,
  outlineClass,
}: DropdownItemProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(label)}
      className={cn(
        'w-36 px-3.5 py-[5px] outline outline-1 outline-offset-[-1px] text-left',
        'transition-[filter] duration-150 hover:brightness-90 focus:outline-none',
        bgClass,
        outlineClass,
      )}
    >
      <span className="text-text-invert-primary text-sm font-medium font-sans">
        {label}
      </span>
    </button>
  );
}

// ── "Actualizado hace / X min" — render en 2 líneas ───────────────────
// Widget reactivo: consume el timestamp del último GFSRequest COMPLETED
// desde el contexto de la timeline (PrecipitationTimelineContext) y calcula
// el texto relativo con el hook `useLatestGfsUpdate`.
//
// Si la ruta actual no tiene timeline montada (ej: /alertas/gestion), el
// contexto será null y el widget mostrará "Sin datos todavía". Esto es
// aceptable: el usuario refresca al volver al mapa y ve el dato real.
import { usePrecipitationTimeline } from '@/features/mapa/timeline/usePrecipitationTimeline';
import { useLatestGfsUpdate } from '@/features/mapa/timeline/useLatestGfsUpdate';

export function UpdatedAtWidget() {
  const ctx = usePrecipitationTimeline();
  const { label } = useLatestGfsUpdate(ctx?.latestCompletedAt ?? null);
  return (
    <div className="flex justify-start items-center gap-2.5 pr-5">
      <RestartIcon
        className={ICON_SIZE + ' text-text-invert-primary'}
        aria-hidden="true"
      />
      <div className="flex flex-col justify-center items-start leading-tight">
        <span className="text-text-invert-primary text-xs font-semibold font-sans">
          {UPDATED_LABEL_PREFIX}
        </span>
        <span className="text-text-invert-primary text-sm font-semibold font-sans">
          {label}
        </span>
      </div>
    </div>
  );
}

// ── Badge rojo "N Confirmadas" — 1 sola línea ─────────────────────────
export function AlertBadgeWidget({ text }: { text: string }) {
  return (
    <div className="flex justify-center items-center">
      <div className="h-10 p-2 bg-secondary-hover rounded-lg outline outline-1 outline-offset-[-1px] outline-secondary-main flex justify-center items-center gap-2.5">
        <AlertIcon
          className={ICON_SIZE + ' text-secondary-main'}
          strokeWidth={2}
          aria-hidden="true"
        />
        <span className="text-secondary-main text-sm font-bold font-sans whitespace-nowrap">
          {text}
        </span>
      </div>
    </div>
  );
}

// ── Stats: "128 Componentes / 6 en Estado Crítico" ────────────────────
export function StatsWidget({
  components,
  critical,
}: {
  components: string;
  critical: string;
}) {
  return (
    <div className="w-64 px-5 py-[3px] flex justify-start items-center gap-4">
      <div className="flex-1 self-stretch inline-flex flex-col justify-center items-start gap-[2px]">
        <span className="text-text-invert-primary text-lg font-bold font-sans leading-6">
          {components}
        </span>
        <span className="text-text-invert-primary text-sm font-normal font-sans leading-5">
          {critical}
        </span>
      </div>
    </div>
  );
}

// ── Botón "Cargar Datos" (dropdown, pallete=2 — primary-dark) ──────────
// Comportamiento según Figma:
//   Estado cerrado: bg-primary-dark, sin shadow, texto blanco bold.
//   Estado abierto : bg-primary-extra-light + outline primary-hover-dark + shadow.
//   Items          : bg-primary-dark, outline primary-light, texto blanco medium.
//
// Opciones: Manual / Excel / Csv. El dropdown se abre con hover+click.
export function LoadDataButton() {
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalFormat, setModalFormat] = useState<'Csv' | 'GeoJson' | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  useClickOutside(containerRef, () => setOpen(false), open);

  const handleSelect = (label: string) => {
    setOpen(false);
    if (label === 'Manual') {
      navigate('/componentes/nuevo');
      return;
    }
    if (label === 'Csv' || label === 'GeoJson') {
      setModalFormat(label);
      setModalOpen(true);
      return;
    }
    console.warn('Cargar Datos → formato no soportado:', label);
  };

  return (
    <div
      ref={containerRef}
      className="relative flex justify-center items-center"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          'h-10 px-2.5 py-2 rounded-lg flex justify-center items-center gap-2 transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-text-invert-primary focus-visible:ring-offset-2',
          open
            ? 'bg-primary-extra-light outline outline-1 outline-offset-[-1px] outline-primary-hover-dark shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]'
            : 'bg-primary-dark hover:bg-primary-hover-dark',
        )}
      >
        <ArchivoIcon
          className={ICON_SIZE + ' text-text-invert-primary'}
          aria-hidden="true"
        />
        <span className="text-text-invert-primary text-sm font-bold font-sans whitespace-nowrap">
          Cargar Datos
        </span>
      </button>

      {/* Lista de opciones (pallete=2: bg-primary-dark, outline primary-light) */}
      {open && (
        <div
          role="listbox"
          className="absolute top-full mt-[5px] right-0 inline-flex flex-col justify-start items-start gap-px z-50"
        >
          {CARGAR_DATOS_OPTIONS.map((option) => (
            <DropdownItem
              key={option}
              label={option}
              bgClass="bg-primary-dark"
              outlineClass="outline-primary-light"
              onClick={handleSelect}
            />
          ))}
        </div>
      )}

      {/* Modal de carga masiva (Csv / GeoJson). El refetch lo gestiona el
          padre al desmontar/remontar, pero aquí exponemos un callback
          opcional: illustra al usuario que la lista se actualizó. No
          pasamos onImported porque la página de gestión hace su propio
          fetch al montar; el modal se abrió desde el topbar que es
          persistente, así que dejamos que el usuario cierre el modal y
          recargue la página manualmente si está en /componentes/gestion. */}
      <CargarDatosModal
        open={modalOpen}
        initialFormat={modalFormat}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}

// ── Botón "Iniciar Sesión" (navega a /login) ────────────────────────────
// Es un <Link> de react-router porque representa navegación, no acción.
// El layout login es la página `/login` que renderiza el formulario.
export function LoginButton() {
  return (
    <div className="px-5 py-3 flex justify-start items-center gap-2.5">
      <Link
        to="/login"
        className="w-36 h-10 p-2 bg-primary-light rounded-lg flex justify-center items-center gap-2
        hover:bg-primary-states-hover-light transition-colors
        focus:outline-none focus-visible:ring-2 focus-visible:ring-text-invert-primary focus-visible:ring-offset-2"
      >
        <span className="text-text-invert-primary text-sm font-bold font-sans whitespace-nowrap">
          Iniciar Sesión
        </span>
        <LogIn
          className={ICON_SIZE + ' text-text-invert-primary'}
          strokeWidth={2}
          aria-hidden="true"
        />
      </Link>
    </div>
  );
}

// ── Selector persistente "Unidad Operativa" (dropdown, pallete=1) ───────
// Comportamiento según Figma:
//   Estado cerrado: bg-primary-light, sin shadow, texto blanco bold.
//   Estado abierto : bg-primary-extra-light + outline button-stroke + shadow.
//   Items          : bg-primary-light, outline primary-light, texto blanco medium.
//
// El dropdown se abre SOLO con click en el botón. NO se cierra al salir con
// el cursor; se cierra solo al elegir una opción o al hacer clic fuera del
// componente (vía `useClickOutside`).
export function UnidadOperativaSelector() {
  const [open, setOpen] = useState(false);
  const { selectedNombre, setSelectedNombre } = useUnidadOperativa();
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false), open);

  // Opciones: "Todas" + los 5 distritos operativos.
  const opciones = [UNIDAD_TODAS, ...UNIDADES_OPERATIVAS.map((u) => u.nombre)];

  return (
    <div
      ref={containerRef}
      className="relative flex justify-start items-center"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          'w-40 h-10 p-2 rounded-lg flex justify-between items-center gap-2 transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-text-invert-primary focus-visible:ring-offset-2',
          open
            ? 'bg-primary-extra-light outline outline-[0.5px] outline-offset-[-0.5px] outline-button-stroke shadow-[0px_3px_5px_0px_rgba(0,0,0,0.25)]'
            : 'bg-primary-light hover:bg-primary-extra-light',
        )}
        aria-label={`${UNIDAD_OPERATIVA_LABEL}: selector`}
      >
        <span className="text-text-invert-primary text-sm font-bold font-sans whitespace-nowrap overflow-hidden text-ellipsis">
          {selectedNombre === UNIDAD_TODAS ? UNIDAD_OPERATIVA_LABEL : selectedNombre}
        </span>
        <FlechaIcon
          className={cn(
            ICON_SIZE,
            'text-text-invert-primary transition-transform duration-200 flex-shrink-0',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>

      {/* Lista de opciones (pallete=1: bg-primary-light) */}
      {open && (
        <div
          role="listbox"
          className="absolute top-full mt-[5px] left-0 inline-flex flex-col justify-start items-start gap-px z-50"
        >
          {opciones.map((option) => (
            <DropdownItem
              key={option}
              label={option}
              bgClass="bg-primary-light"
              outlineClass="outline-primary-light"
              onClick={(label) => {
                setSelectedNombre(label);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// `renderWidget` y `topbarSectionCx` están en `TopBarWidgets.render.tsx`
// para cumplir con la regla `react-refresh/only-export-components` de ESLint.
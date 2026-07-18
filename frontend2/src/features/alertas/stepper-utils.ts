import type {
  AlertaHistorica,
  EstadoAlertaHistorica,
  EstadoPaso,
  FaseStepper,
  HistoricoEstado,
} from './types';

/**
 * Helpers para derivar el estado visual del Stepper a partir del estado
 * actual de la alerta.
 *
 * El stepper tiene 3 fases:
 *   1) Notificado
 *   2) Confirmado
 *   3) Atendido
 *
 * Y cada paso puede estar en uno de 3 estados visuales:
 *   - hecho:   ya pasó esa fase
 *   - proceso: la alerta está en esa fase actualmente
 *   - falta:   esa fase todavía no empieza
 */

const FASES: FaseStepper[] = ['notificado', 'confirmado', 'atendido'];

/** Mapea estado interno → fase visual del stepper. */
function estadoToFase(estado: EstadoAlertaHistorica): FaseStepper {
  switch (estado) {
    case 'predicho':
    case 'en-espera-confirmacion':
    case 'no-confirmado':
      return 'notificado';
    case 'confirmado':
    case 'en-espera-reporte':
    case 'en-proceso-atencion':
      return 'confirmado';
    case 'atendido':
      return 'atendido';
  }
}

/** Calcula el estado visual de cada paso del stepper. */
export function calcularPasos(
  alerta: AlertaHistorica,
): Array<{ fase: FaseStepper; label: string; estado: EstadoPaso; fecha?: string }> {
  const faseActual = estadoToFase(alerta.estado);
  const idxActual = FASES.indexOf(faseActual);

  // Fechas por fase (extraídas del historico de la alerta).
  // Notificado: la fecha de notificación.
  // Confirmado: la fecha en que se confirmó (busca 'confirmado' en historico).
  // Atendido: la fecha final o de atención (busca 'atendido' o último registro).
  const fechaNotificado = alerta.fechaNotificacion;
  const histConfirmado = alerta.historico.find(
    (h: HistoricoEstado) => h.estado === 'confirmado',
  );
  const fechaConfirmado = histConfirmado?.fecha ?? alerta.fechaRealInicio;
  const histAtendido = alerta.historico.find(
    (h: HistoricoEstado) => h.estado === 'atendido',
  );
  const fechaAtendido = histAtendido?.fecha ?? alerta.fechaFinalizacion;

  const fechas: Record<FaseStepper, string | undefined> = {
    notificado: fechaNotificado,
    confirmado: fechaConfirmado,
    atendido: fechaAtendido,
  };

  const labels: Record<FaseStepper, string> = {
    notificado: 'Notificado',
    confirmado: 'Confirmado',
    atendido: 'Atendido',
  };

  return FASES.map((fase, idx) => {
    let estadoPaso: EstadoPaso;
    if (idx < idxActual) estadoPaso = 'hecho';
    else if (idx === idxActual) estadoPaso = 'proceso';
    else estadoPaso = 'falta';
    return {
      fase,
      label: labels[fase],
      estado: estadoPaso,
      fecha: fechas[fase],
    };
  });
}

/** Calcula el estado de los separadores entre pasos (línea horizontal). */
export function calcularSeparadores(
  pasos: ReturnType<typeof calcularPasos>,
): Array<{ estado: 'activo' | 'inactivo' }> {
  // Separador i está activo si el paso i+1 ya empezó (hecho o proceso).
  const seps: Array<{ estado: 'activo' | 'inactivo' }> = [];
  for (let i = 0; i < pasos.length - 1; i++) {
    const next = pasos[i + 1];
    seps.push({
      estado: next.estado === 'hecho' || next.estado === 'proceso' ? 'activo' : 'inactivo',
    });
  }
  return seps;
}

/** Formatea un ISO 8601 a "DD/MM/YYYY HH:mm" (hora local del navegador). */
export function formatFechaHora(iso: string): string {
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  } catch {
    return iso;
  }
}

/** Formatea un ISO 8601 a "DD MMM YYYY" (ej. "22 Jun 2026"). */
export function formatFechaCorta(iso: string): string {
  try {
    const d = new Date(iso);
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = meses[d.getMonth()];
    const yyyy = d.getFullYear();
    return `${dd} ${mm} ${yyyy}`;
  } catch {
    return iso;
  }
}

/** Formatea un ISO 8601 a "HH:mm". */
export function formatHora(iso: string): string {
  try {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${min}`;
  } catch {
    return iso;
  }
}

/**
 * Calcula tiempo transcurrido desde una fecha ISO hasta ahora.
 * Devuelve "X h Y min" o "Y min" si es menos de 1h.
 */
export function tiempoTranscurrido(iso: string): string {
  try {
    const desde = new Date(iso).getTime();
    const ahora = Date.now();
    const diffMin = Math.floor((ahora - desde) / 60_000);
    if (diffMin < 60) return `${diffMin} min`;
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return `${h} h ${m} min`;
  } catch {
    return '—';
  }
}
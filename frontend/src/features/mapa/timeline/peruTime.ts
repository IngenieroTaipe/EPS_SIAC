/**
 * Hora actual de Perú (PET = UTC-5 fijo; sin horario de verano).
 *
 * Implementación: `Intl.DateTimeFormat` con `timeZone: 'America/Lima'`
 * extrae las partes de fecha/hora en Perú y construye un `Date` con esa
 * información interpretada en la zona horaria local del runtime. Esto
 * permite usar `.getHours()`, `.getDay()` y `.getDate()` (que son
 * timezone-local) y obtener valores coherentes con la hora de Perú sin
 * importar dónde se ejecute el contenedor (Docker en UTC, navegador del
 * usuario, etc.).
 *
 * Uso típico: `currentRealHour={peruNow()}` para la franja roja del
 * timeline, que debe marcar SIEMPRE la hora real de Perú.
 */
export function peruNow(): Date {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date()).map((p) => [p.type, p.value]),
  ) as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', string>;

  const hour = Number(parts.hour) === 24 ? 0 : Number(parts.hour);

  return new Date(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second),
  );
}

/** Inicio del día de Perú (00:00 local-Reino representado como Date). */
export function peruStartOfDay(): Date {
  const now = peruNow();
  now.setHours(0, 0, 0, 0);
  return now;
}
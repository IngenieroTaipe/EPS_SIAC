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

const PET_TS_PARTS = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/;
// ISO con `Z` (UTC) — caso legacy: requiere conversión a PET.
const ISO_UTC_PARTS = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?Z$/;
// ISO con offset explícito (p. ej. `2026-07-30T20:00:00-05:00`). El builder
// PostGIS emite wall-clock PET con offset `-05:00` fijo (PET no tiene DST),
// así que las partes SÍ son directamente los valores de Perú: no hay que
// convertir. Aceptamos también ausencia de offset (wall-clock naive).
const ISO_OFFSET_PARTS = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:[+-]\d{2}:\d{2})?$/;

/**
 * ParsePetTimestamp — construye un `Date` a partir de un `timestamp_utc`
 * emitido por el endpoint GFS de clústeres/celdas.
 *
 * Formatos aceptados (el builder PostGIS siempre produce el primero hoy):
 *   1. ISO con offset explícito, wall-clock ya en PET:
 *        "2026-07-30T20:00:00-05:00"   (lo que emite `geojson_builder.py`)
 *      Las partes (Y/M/D/H/M/S) son directamente los valores de Perú: NO
 *      se convierten. El offset `-05:00` es literal fijo (PET sin DST).
 *   2. ISO con `Z` (UTC legacy): requiere convertir el instante UTC a PET
 *      vía `Intl.DateTimeFormat('America/Lima')`.
 *   3. Wall-clock "YYYY-MM-DD HH:mm [PET]" (legacy legible).
 *
 * El `Date` resultante interpreta los partes de wall-clock peruano como
 * wall-clock del runtime (igual que `peruNow`), de modo que `.getHours()`,
 * `.getDay()` y `.getDate()` devuelvan directamente los valores de Perú
 * sin depender del timezone del contenedor. Esta es la misma convención
 * usada por `peruNow` y la frontend; si el runtime es UTC (Docker) o
 * America/Lima (browser local), los partes se interpretan igual.
 *
 * Devuelve `null` si el formato no coincide (defensivo).
 */
export function parsePetTimestamp(s: string | null | undefined): Date | null {
  if (!s) return null;
  const trimmed = s.trim();

  // Caso ISO 8601 UTC "YYYY-MM-DDTHH:mm[:ss]Z" — lo que realmente emite el
  // backend GFS. Convertimos el instante UTC a partes de hora de Perú con
  // el mismo mecanismo que `peruNow` (Intl.DateTimeFormat, timeZone
  // 'America/Lima'), SIN restar offset a mano. Así el eje queda alineado
  // con la franja roja y el thumb inicial cae en un slot con clusters.
  const iso = trimmed.match(ISO_UTC_PARTS);
  if (iso) {
    const [, y, mo, d, h, mi, se] = iso;
    const instantMs = Date.UTC(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      Number(se ?? 0),
      0,
    );
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
      fmt.formatToParts(new Date(instantMs)).map((p) => [p.type, p.value]),
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

  // Caso ISO con offset explícito (o sin offset) — wall-clock ya está en
  // Perú (el builder PostGIS formatea con `AT TIME ZONE 'America/Lima'` y
  // sufija `-05:00` literal). Interpretamos las partes directamente como
  // wall-clock del runtime, igual que `peruNow`.
  const isoOff = trimmed.match(ISO_OFFSET_PARTS);
  if (isoOff) {
    const [, y, mo, d, h, mi, se] = isoOff;
    return new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
      Number(se ?? 0),
      0,
    );
  }

  // Caso wall-clock "YYYY-MM-DD HH:mm [PET]".
  const m = trimmed.match(PET_TS_PARTS);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  return new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    0,
    0,
  );
}
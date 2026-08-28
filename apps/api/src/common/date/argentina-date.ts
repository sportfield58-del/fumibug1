/**
 * "Hoy" en columnas `@db.Date` (routeDate, scheduledDate) — Fase 1 es monoempresa
 * argentina (docs/spec/00-overview.md), así que hoy es siempre el calendario de
 * Argentina, UTC-3 fijo (sin horario de verano desde 2009, no hace falta una zona
 * horaria real de IANA para esto).
 *
 * Bug real que esto arregla: `new Date().toISOString().slice(0, 10)` calcula el día
 * calendario en UTC, no en Argentina. Entre las 21:00 y las 23:59 hora argentina, UTC
 * ya está en el día siguiente — "hoy" en el servidor dejaba de coincidir con "hoy" en
 * la pantalla del usuario (ej. una ruta creada para hoy a la tarde/noche dejaba de
 * aparecer en GET /field/today apenas pasaban las 21:00).
 */

const ARGENTINA_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Fecha calendario de Argentina "ahora mismo", como 'YYYY-MM-DD'. */
export function argentinaTodayStr(): string {
  return new Date(Date.now() - ARGENTINA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Medianoche UTC del día calendario de Argentina actual — así se guardan routeDate/scheduledDate (ver routes.service.ts create()). */
export function argentinaTodayUtcMidnight(): Date {
  return new Date(`${argentinaTodayStr()}T00:00:00.000Z`);
}

/** Rango [start, end) para filtrar "hoy" contra una columna @db.Date o @db.Timestamptz. */
export function argentinaDayBounds(): { start: Date; end: Date } {
  const start = argentinaTodayUtcMidnight();
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

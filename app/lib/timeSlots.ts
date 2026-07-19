// Helpers de slots. Todo en tz America/Chicago (Lafayette, LA).
// El slot es una hora entera 8..19; representamos el "inicio" del slot
// como ISO local "YYYY-MM-DDTHH:00:00" (sin tz suffix — la app entiende
// que es CT).
//
// slotId (para Firestore doc id) = slot con ":" reemplazado por "-":
//   "2026-07-18T14:00:00" → "2026-07-18T14-00-00"

import { DEFAULT_HOURS, OPERATION_TZ, type WorkingHours } from '../types';

export function slotIsoToId(iso: string): string {
  return iso.replace(/:/g, '-');
}

export function slotIdToIso(id: string): string {
  // Reemplaza los últimos 2 guiones por ":" (después del T).
  const tIdx = id.indexOf('T');
  if (tIdx < 0) return id;
  const datePart = id.slice(0, tIdx);
  const timePart = id.slice(tIdx + 1).replace(/-/g, ':');
  return `${datePart}T${timePart}`;
}

/** "YYYY-MM-DD" para una Date en tz CT. */
export function ctDateStr(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: OPERATION_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Hora entera (0..23) actual en CT. */
export function ctHour(d: Date = new Date()): number {
  const s = new Intl.DateTimeFormat('en-GB', {
    timeZone: OPERATION_TZ,
    hour: '2-digit',
    hour12: false,
  }).format(d);
  return parseInt(s, 10);
}

/** Día de semana 0..6 (0=Sun..6=Sat) para una fecha "YYYY-MM-DD" en CT. */
export function dayOfWeekOf(dateStr: string): number {
  // midday para no cruzar DST issues.
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone: OPERATION_TZ,
    weekday: 'short',
  })
    .format(new Date(`${dateStr}T12:00:00`))
    .toLowerCase();
  const map: Record<string, number> = {
    sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
  };
  return map[short.slice(0, 3)] ?? 0;
}

/** Devuelve los proximos N días como "YYYY-MM-DD" en CT, incluyendo hoy. */
export function next7DaysCT(n: number = 7): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
    out.push(ctDateStr(d));
  }
  return out;
}

/** Compute hours abiertas para un día de la semana según config. */
export function openHoursFor(
  dayOfWeek: number,
  cfg: WorkingHours | null
): number[] {
  if (cfg?.hoursByDayOfWeek && cfg.hoursByDayOfWeek[dayOfWeek] !== undefined) {
    return cfg.hoursByDayOfWeek[dayOfWeek] as number[];
  }
  return DEFAULT_HOURS.slice() as number[];
}

/** Un dateStr "YYYY-MM-DD" está bloqueado en la config. */
export function isDateBlocked(
  dateStr: string,
  cfg: WorkingHours | null
): boolean {
  return !!cfg?.blockedDates?.includes(dateStr);
}

/** Format hora "8" → "8 AM", "13" → "1 PM", "20" → "8 PM". */
export function formatHour(h: number): string {
  const suffix = h >= 12 ? 'PM' : 'AM';
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve} ${suffix}`;
}

/** Format slot inicio-fin "8 AM – 9 AM". */
export function formatSlotRange(h: number): string {
  return `${formatHour(h)} – ${formatHour(h + 1)}`;
}

/** Format dateStr "2026-07-18" → "Thu, Jul 18". */
export function formatDateShort(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: OPERATION_TZ,
  }).format(d);
}

/** ¿La hora slot está en el pasado? Usamos +30min buffer para no
 *  permitir reservar el slot que arranca en 5 minutos. */
export function isPastSlot(dateStr: string, hour: number): boolean {
  const today = ctDateStr();
  const currentH = ctHour();
  if (dateStr < today) return true;
  if (dateStr > today) return false;
  return hour <= currentH;
}

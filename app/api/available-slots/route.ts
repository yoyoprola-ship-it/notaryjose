import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/app/lib/firebaseAdmin';
import { getClientIp, rateLimitOr429 } from '@/app/lib/rateLimit';
import type { WorkingHours } from '@/app/types';
import {
  dayOfWeekOf,
  isDateBlocked,
  isPastSlot,
  next7DaysCT,
  openHoursFor,
} from '@/app/lib/timeSlots';

// GET /api/available-slots
// Returns hasta 7 días con slots agendables. Filtra horas ya pasadas
// (no aparecen para nada) y skipea días fully-past o fully-closed.
// Si HOY ya no tiene slots libres, empezamos por MAÑANA — pero
// siempre devolvemos 7 días válidos como upper cap.
//
// Shape:
//   { days: [{ date, dayOfWeek, hours: [{ hour, iso, available, reason? }] }] }

interface DayResponse {
  date: string;
  dayOfWeek: number;
  hours: {
    hour: number;
    iso: string;
    available: boolean;
    reason?: 'booked' | 'closed';
  }[];
}

const TARGET_DAYS = 30;
const LOOKAHEAD_DAYS = 45; // buffer para saltar days fully past/closed

export async function GET(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rl = await rateLimitOr429(`nj-available-slots-ip:${ip}`, {
    maxRequests: 60,
    windowMs: 60_000,
  });
  if (rl) return rl;

  try {
    // Load working hours config
    const cfgSnap = await adminDb.doc('notaryjose_config/hours').get();
    const cfg = cfgSnap.exists ? (cfgSnap.data() as WorkingHours) : null;

    // Candidatos: hoy + 13 días. Después filtramos a TARGET_DAYS válidos.
    const candidates = next7DaysCT(LOOKAHEAD_DAYS);

    // Bookings confirmed en el rango de candidatos. Range query evita el
    // límite de 30 items del operador `in`.
    const bookingSnap = await adminDb
      .collection('notaryjose_bookings')
      .where('slotDate', '>=', candidates[0])
      .where('slotDate', '<=', candidates[candidates.length - 1])
      .where('status', '==', 'confirmed')
      .get();

    const bookedSet = new Set<string>();
    bookingSnap.docs.forEach((d) => {
      const data = d.data();
      bookedSet.add(
        `${data.slotDate}T${String(data.slotHour).padStart(2, '0')}`
      );
    });

    const out: DayResponse[] = [];
    for (const date of candidates) {
      if (out.length >= TARGET_DAYS) break;

      const dow = dayOfWeekOf(date);
      const openHours = isDateBlocked(date, cfg) ? [] : openHoursFor(dow, cfg);
      const openSet = new Set(openHours);

      const hours: DayResponse['hours'] = [];
      for (let h = 8; h <= 19; h++) {
        // Skip horas pasadas — ni aparecen. Es la diferencia clave con
        // la versión anterior que las mostraba con reason='past'.
        if (isPastSlot(date, h)) continue;

        const iso = `${date}T${String(h).padStart(2, '0')}:00:00`;
        const key = `${date}T${String(h).padStart(2, '0')}`;
        let available = true;
        let reason: 'booked' | 'closed' | undefined;
        if (!openSet.has(h)) {
          available = false;
          reason = 'closed';
        } else if (bookedSet.has(key)) {
          available = false;
          reason = 'booked';
        }
        hours.push({ hour: h, iso, available, reason });
      }

      // Si no queda ninguna hora (día fully past + no future slots),
      // skipeamos el día para no mostrar una columna vacía.
      if (hours.length === 0) continue;

      // Si el día es fully closed (todas las horas marcadas closed y
      // ninguna available/booked), también skipeamos — un día donde
      // no hay nada para reservar solo agrega ruido al selector.
      const hasAnyOpenOrBooked = hours.some(
        (h) => h.available || h.reason === 'booked'
      );
      if (!hasAnyOpenOrBooked) continue;

      out.push({ date, dayOfWeek: dow, hours });
    }

    return NextResponse.json({ days: out });
  } catch (err) {
    console.error('[available-slots] failed:', err);
    return NextResponse.json(
      { error: 'Could not load slots' },
      { status: 500 }
    );
  }
}

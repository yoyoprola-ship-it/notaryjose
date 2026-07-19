import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/app/lib/firebaseAdmin';
import { getClientIp, rateLimitOr429 } from '@/app/lib/rateLimit';
import type { WorkingHours } from '@/app/types';
import {
  ctDateStr,
  dayOfWeekOf,
  isDateBlocked,
  isPastSlot,
  next7DaysCT,
  openHoursFor,
  slotIsoToId,
} from '@/app/lib/timeSlots';

// GET /api/available-slots
// Returns the next 7 days with per-hour availability status.
// Public, no auth. Rate-limited per IP.
//
// Shape:
//   [{
//     date: "2026-07-18",
//     dayOfWeek: 6,
//     hours: [
//       { hour: 8, iso: "2026-07-18T08:00:00", available: true },
//       ...
//     ]
//   }, ...]

interface DayResponse {
  date: string;
  dayOfWeek: number;
  hours: {
    hour: number;
    iso: string;
    available: boolean;
    reason?: 'past' | 'booked' | 'closed';
  }[];
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rl = await rateLimitOr429(`nj-available-slots-ip:${ip}`, {
    maxRequests: 60,
    windowMs: 60_000,
  });
  if (rl) return rl;

  try {
    // Load working hours config (single doc)
    const cfgSnap = await adminDb
      .doc('notaryjose_config/hours')
      .get();
    const cfg = cfgSnap.exists ? (cfgSnap.data() as WorkingHours) : null;

    const dates = next7DaysCT(7);

    // Load ALL confirmed bookings for those dates in one query
    const bookingSnap = await adminDb
      .collection('notaryjose_bookings')
      .where('slotDate', 'in', dates)
      .where('status', '==', 'confirmed')
      .get();

    const bookedSet = new Set<string>();
    bookingSnap.docs.forEach((d) => {
      const data = d.data();
      bookedSet.add(`${data.slotDate}T${String(data.slotHour).padStart(2, '0')}`);
    });

    const today = ctDateStr();
    void today; // reserved for future use

    const out: DayResponse[] = dates.map((date) => {
      const dow = dayOfWeekOf(date);
      const openHours = isDateBlocked(date, cfg) ? [] : openHoursFor(dow, cfg);
      const openSet = new Set(openHours);

      // Always show 8..19 in the response, mark unavailable ones
      const hours = [];
      for (let h = 8; h <= 19; h++) {
        const iso = `${date}T${String(h).padStart(2, '0')}:00:00`;
        const key = `${date}T${String(h).padStart(2, '0')}`;
        let available = true;
        let reason: 'past' | 'booked' | 'closed' | undefined;
        if (!openSet.has(h)) {
          available = false;
          reason = 'closed';
        } else if (bookedSet.has(key)) {
          available = false;
          reason = 'booked';
        } else if (isPastSlot(date, h)) {
          available = false;
          reason = 'past';
        }
        hours.push({ hour: h, iso, available, reason });
      }

      return { date, dayOfWeek: dow, hours };
    });

    // Helper para el cliente si quiere mostrar el doc id (para keys)
    void slotIsoToId;

    return NextResponse.json({ days: out });
  } catch (err) {
    console.error('[available-slots] failed:', err);
    return NextResponse.json(
      { error: 'Could not load slots' },
      { status: 500 }
    );
  }
}

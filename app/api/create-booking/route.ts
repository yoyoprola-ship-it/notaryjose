import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/app/lib/firebaseAdmin';
import {
  getClientIp,
  rateLimitOr429,
  userRateLimitOr429,
} from '@/app/lib/rateLimit';
import type { WorkingHours } from '@/app/types';
import {
  dayOfWeekOf,
  isDateBlocked,
  isPastSlot,
  openHoursFor,
  slotIsoToId,
} from '@/app/lib/timeSlots';
import { notifyOwnerOfBooking } from '@/app/lib/notifyOwner';

// POST /api/create-booking
// Header: Authorization: Bearer <Firebase ID token>
// Body: { slot: "YYYY-MM-DDTHH:00:00", customerName, notes? }
//
// Crea la cita atómicamente. Doc id = slotIsoToId(slot) → `create`
// falla si ya existe otro booking en ese slot = anti-double-booking.
// Verifica que el slot esté abierto en la config y no sea pasado.

interface Body {
  slot?: string;
  customerName?: string;
  notes?: string;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const ipRl = await rateLimitOr429(`nj-create-booking-ip:${ip}`, {
    maxRequests: 10,
    windowMs: 60_000,
  });
  if (ipRl) return ipRl;

  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return NextResponse.json({ error: 'Missing auth token' }, { status: 401 });
  }

  let uid: string;
  let phoneFromToken: string;
  try {
    const decoded = await adminAuth.verifyIdToken(token, true);
    uid = decoded.uid;
    const raw = (decoded.phone_number || '').replace(/\D/g, '');
    phoneFromToken = raw.slice(-10);
    if (phoneFromToken.length !== 10) {
      return NextResponse.json(
        { error: 'Phone verification required' },
        { status: 403 }
      );
    }
  } catch {
    return NextResponse.json({ error: 'Invalid auth token' }, { status: 401 });
  }

  const uidRl = await userRateLimitOr429('nj-create-booking', uid, {
    maxRequests: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (uidRl) return uidRl;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const slot = (body.slot || '').trim();
  const customerName = (body.customerName || '').trim().slice(0, 80);
  const notes = (body.notes || '').trim().slice(0, 500);

  if (!/^\d{4}-\d{2}-\d{2}T(0[8-9]|1[0-9])(?::00:00|:00)?$/.test(slot)) {
    return NextResponse.json(
      { error: 'Invalid slot (expected YYYY-MM-DDTHH:00:00 with HH between 08–19)' },
      { status: 400 }
    );
  }
  // Normalize slot to full form
  const slotIso = slot.length === 13 ? `${slot}:00:00` : slot;

  const m = slotIso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):/);
  if (!m) {
    return NextResponse.json({ error: 'Invalid slot format' }, { status: 400 });
  }
  const slotDate = m[1];
  const slotHour = parseInt(m[2], 10);

  if (customerName.length < 2) {
    return NextResponse.json({ error: 'Name too short' }, { status: 400 });
  }
  if (slotHour < 8 || slotHour > 19) {
    return NextResponse.json(
      { error: 'Slot hour must be 8–19 (8 AM – 8 PM)' },
      { status: 400 }
    );
  }
  if (isPastSlot(slotDate, slotHour)) {
    return NextResponse.json(
      { error: 'That time is already past.' },
      { status: 400 }
    );
  }

  // Verify slot is open per working hours config
  try {
    const cfgSnap = await adminDb.doc('notaryjose_config/hours').get();
    const cfg = cfgSnap.exists ? (cfgSnap.data() as WorkingHours) : null;
    if (isDateBlocked(slotDate, cfg)) {
      return NextResponse.json(
        { error: "That day is closed." },
        { status: 400 }
      );
    }
    const dow = dayOfWeekOf(slotDate);
    const open = openHoursFor(dow, cfg);
    if (!open.includes(slotHour)) {
      return NextResponse.json(
        { error: 'That hour is not available.' },
        { status: 400 }
      );
    }
  } catch (err) {
    console.error('[create-booking] config load failed:', err);
    return NextResponse.json({ error: 'Config error' }, { status: 500 });
  }

  // Atomic create — falla si ya existe otro booking en el slot.
  const docId = slotIsoToId(slotIso);
  const ref = adminDb.collection('notaryjose_bookings').doc(docId);
  try {
    await ref.create({
      slot: slotIso,
      slotDate,
      slotHour,
      customerName,
      customerPhone: phoneFromToken,
      userId: uid,
      status: 'confirmed',
      notes,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err: unknown) {
    // Firestore Admin SDK arroja code=6 ALREADY_EXISTS
    interface FirestoreLikeError { code?: number | string; message?: string }
    const e = err as FirestoreLikeError;
    if (e?.code === 6 || String(e?.message || '').toLowerCase().includes('already exists')) {
      return NextResponse.json(
        { error: 'That time was just booked. Please pick another.' },
        { status: 409 }
      );
    }
    console.error('[create-booking] write failed:', err);
    return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  }

  // Fire-and-forget SMS al owner
  notifyOwnerOfBooking({
    customerName,
    customerPhone: phoneFromToken,
    slotIso,
  }).catch((err) => {
    console.error('[create-booking] notify (unhandled):', err);
  });

  return NextResponse.json({ ok: true, id: docId, slot: slotIso });
}

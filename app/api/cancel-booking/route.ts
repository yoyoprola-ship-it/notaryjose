import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/app/lib/firebaseAdmin';
import { notifyOwnerOfCancellation } from '@/app/lib/notifyOwner';
import { getClientIp, rateLimitOr429, userRateLimitOr429 } from '@/app/lib/rateLimit';
import type { Booking } from '@/app/types';

interface Body { bookingId?: unknown }

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rl = await rateLimitOr429(`nj-cancel-booking-ip:${ip}`, {
    maxRequests: 10,
    windowMs: 60_000,
  });
  if (rl) return rl;

  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return NextResponse.json({ error: 'Missing auth token' }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(token, true);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Invalid auth token' }, { status: 401 });
  }

  const ulr = await userRateLimitOr429('nj-cancel-booking', uid, {
    maxRequests: 5,
    windowMs: 60 * 60_000,
  });
  if (ulr) return ulr;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const bookingId = typeof body.bookingId === 'string' ? body.bookingId.trim() : '';
  if (!bookingId) {
    return NextResponse.json({ error: 'bookingId required' }, { status: 400 });
  }

  try {
    const ref = adminDb.collection('notaryjose_bookings').doc(bookingId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }
    const booking = { id: snap.id, ...snap.data() } as Booking;
    if (booking.userId !== uid) {
      return NextResponse.json({ error: 'Not your booking' }, { status: 403 });
    }
    if (booking.status === 'cancelled') {
      return NextResponse.json({ error: 'Already cancelled' }, { status: 409 });
    }

    await ref.update({
      status: 'cancelled',
      cancelledAt: FieldValue.serverTimestamp(),
      cancelledBy: 'user',
    });

    // Fire-and-forget SMS to owner
    notifyOwnerOfCancellation({
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      slotIso: booking.slot,
    }).catch((err) => console.error('[cancel-booking] notify failed:', err));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[cancel-booking] failed:', err);
    return NextResponse.json({ error: 'Cancel failed' }, { status: 500 });
  }
}

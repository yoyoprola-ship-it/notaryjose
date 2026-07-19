import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/app/lib/firebaseAdmin';
import { requireOwner } from '@/app/lib/ownerApiAuth';
import { getClientIp, rateLimitOr429, userRateLimitOr429 } from '@/app/lib/rateLimit';

interface Body { bookingId?: unknown }

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rl = await rateLimitOr429(`nj-owner-cancel-ip:${ip}`, {
    maxRequests: 20,
    windowMs: 60_000,
  });
  if (rl) return rl;

  const auth = await requireOwner(request);
  if (!auth.ok) return auth.response;

  const ulr = await userRateLimitOr429('nj-owner-cancel', auth.uid, {
    maxRequests: 30,
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
    if (snap.data()?.status === 'cancelled') {
      return NextResponse.json({ error: 'Already cancelled' }, { status: 409 });
    }
    await ref.update({
      status: 'cancelled',
      cancelledAt: FieldValue.serverTimestamp(),
      cancelledBy: 'owner',
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[owner/bookings/cancel] failed:', err);
    return NextResponse.json({ error: 'Cancel failed' }, { status: 500 });
  }
}

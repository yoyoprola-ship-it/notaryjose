import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/app/lib/firebaseAdmin';
import { getClientIp, rateLimitOr429, userRateLimitOr429 } from '@/app/lib/rateLimit';
import type { Booking } from '@/app/types';

export async function GET(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rl = await rateLimitOr429(`nj-my-bookings-ip:${ip}`, {
    maxRequests: 20,
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

  const ulr = await userRateLimitOr429('nj-my-bookings', uid, {
    maxRequests: 10,
    windowMs: 5 * 60_000,
  });
  if (ulr) return ulr;

  try {
    const snap = await adminDb
      .collection('notaryjose_bookings')
      .where('userId', '==', uid)
      .where('status', '==', 'confirmed')
      .get();

    const nowIso = new Date().toISOString().slice(0, 19);
    const bookings: Booking[] = snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Booking))
      .filter((b) => b.slot >= nowIso)
      .sort((a, b) => a.slot.localeCompare(b.slot));

    return NextResponse.json({ bookings });
  } catch (err) {
    console.error('[my-bookings] failed:', err);
    return NextResponse.json({ error: 'Failed to load bookings' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/app/lib/firebaseAdmin';
import { requireOwner } from '@/app/lib/ownerApiAuth';
import { getClientIp, rateLimitOr429 } from '@/app/lib/rateLimit';
import type { Booking } from '@/app/types';

export async function GET(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rl = await rateLimitOr429(`nj-owner-bookings-get-ip:${ip}`, {
    maxRequests: 30,
    windowMs: 60_000,
  });
  if (rl) return rl;

  const auth = await requireOwner(request);
  if (!auth.ok) return auth.response;

  try {
    const snap = await adminDb
      .collection('notaryjose_bookings')
      .orderBy('slot', 'asc')
      .get();
    const bookings: Booking[] = snap.docs.map(
      (d) => ({ id: d.id, ...d.data() } as Booking)
    );
    return NextResponse.json({ bookings });
  } catch (err) {
    console.error('[owner/bookings GET] failed:', err);
    return NextResponse.json({ error: 'Failed to load bookings' }, { status: 500 });
  }
}

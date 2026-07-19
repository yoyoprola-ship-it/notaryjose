import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/app/lib/firebaseAdmin';
import { getClientIp, rateLimitOr429 } from '@/app/lib/rateLimit';

interface Body { phone?: unknown }

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rl = await rateLimitOr429(`nj-check-cancel-phone-ip:${ip}`, {
    maxRequests: 5,
    windowMs: 60_000,
  });
  if (rl) return rl;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const raw = typeof body.phone === 'string' ? body.phone : '';
  const digits = raw.replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) {
    return NextResponse.json({ error: 'Invalid phone' }, { status: 400 });
  }

  try {
    const nowIso = new Date().toISOString().slice(0, 19);
    const snap = await adminDb
      .collection('notaryjose_bookings')
      .where('customerPhone', '==', digits)
      .where('status', '==', 'confirmed')
      .limit(10)
      .get();

    const hasUpcoming = snap.docs.some((d) => {
      const slot = d.data().slot as string | undefined;
      return slot && slot >= nowIso;
    });

    return NextResponse.json({ hasBookings: hasUpcoming });
  } catch (err) {
    console.error('[check-cancel-phone] failed:', err);
    return NextResponse.json({ error: 'Check failed' }, { status: 500 });
  }
}

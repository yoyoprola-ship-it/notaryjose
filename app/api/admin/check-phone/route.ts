import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/app/lib/firebaseAdmin';
import { getClientIp, rateLimitOr429 } from '@/app/lib/rateLimit';

interface Body { phone?: unknown }

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rl = await rateLimitOr429(`nj-check-phone-ip:${ip}`, {
    maxRequests: 10,
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
    let snap = await adminDb
      .collection('users')
      .where('phone', '==', digits)
      .limit(1)
      .get();
    if (snap.empty) {
      snap = await adminDb
        .collection('users')
        .where('phone', '==', `+1${digits}`)
        .limit(1)
        .get();
    }
    if (snap.empty) return NextResponse.json({ canLogin: false });
    const canLogin = snap.docs[0].data()?.role === 'admin';
    return NextResponse.json({ canLogin });
  } catch (err) {
    console.error('[check-phone] failed:', err);
    return NextResponse.json({ error: 'Auth check failed' }, { status: 500 });
  }
}

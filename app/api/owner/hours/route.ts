import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/app/lib/firebaseAdmin';
import { requireOwner } from '@/app/lib/ownerApiAuth';
import { getClientIp, rateLimitOr429 } from '@/app/lib/rateLimit';
import type { WorkingHours } from '@/app/types';

export async function GET(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rl = await rateLimitOr429(`nj-owner-hours-get-ip:${ip}`, {
    maxRequests: 30,
    windowMs: 60_000,
  });
  if (rl) return rl;

  const auth = await requireOwner(request);
  if (!auth.ok) return auth.response;

  try {
    const snap = await adminDb.collection('notaryjose_config').doc('hours').get();
    const data: WorkingHours = snap.exists ? (snap.data() as WorkingHours) : {};
    return NextResponse.json({ data });
  } catch (err) {
    console.error('[owner/hours GET] failed:', err);
    return NextResponse.json({ error: 'Failed to load hours' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rl = await rateLimitOr429(`nj-owner-hours-post-ip:${ip}`, {
    maxRequests: 10,
    windowMs: 60_000,
  });
  if (rl) return rl;

  const auth = await requireOwner(request);
  if (!auth.ok) return auth.response;

  let body: Partial<WorkingHours>;
  try {
    body = (await request.json()) as Partial<WorkingHours>;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  try {
    await adminDb
      .collection('notaryjose_config')
      .doc('hours')
      .set(
        {
          hoursByDayOfWeek: body.hoursByDayOfWeek || {},
          blockedDates: body.blockedDates || [],
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[owner/hours POST] failed:', err);
    return NextResponse.json({ error: 'Failed to save hours' }, { status: 500 });
  }
}

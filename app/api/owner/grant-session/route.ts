import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/app/lib/firebaseAdmin';
import { requireOwnerWithoutSession, OWNER_SESSION_FIELD } from '@/app/lib/ownerApiAuth';
import { getClientIp, rateLimitOr429 } from '@/app/lib/rateLimit';

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rl = await rateLimitOr429(`nj-owner-grant-session-ip:${ip}`, {
    maxRequests: 10,
    windowMs: 60_000,
  });
  if (rl) return rl;

  const auth = await requireOwnerWithoutSession(request);
  if (!auth.ok) return auth.response;

  try {
    // merge: true creates the doc if the owner has no Firestore user record yet
    await adminDb
      .collection('users')
      .doc(auth.uid)
      .set({ [OWNER_SESSION_FIELD]: FieldValue.serverTimestamp() }, { merge: true });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[owner/grant-session] failed:', err);
    return NextResponse.json({ error: 'Session grant failed' }, { status: 500 });
  }
}

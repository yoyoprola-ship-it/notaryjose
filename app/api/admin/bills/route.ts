import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/app/lib/firebaseAdmin';

async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return false;
  try {
    const decoded = await adminAuth.verifyIdToken(token, true);
    const snap = await adminDb.collection('users').doc(decoded.uid).get();
    return snap.exists && (snap.data() as { role?: string })?.role === 'admin';
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  if (!await verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const snap = await adminDb
    .collection('notaryjose_bills')
    .orderBy('period', 'desc')
    .get();
  const bills = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ bills });
}

export async function PATCH(request: NextRequest) {
  if (!await verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { period } = await request.json() as { period: string };
  if (!period) return NextResponse.json({ error: 'Missing period' }, { status: 400 });
  await adminDb.collection('notaryjose_bills').doc(period).update({
    status: 'paid',
    paidAt: FieldValue.serverTimestamp(),
  });
  return NextResponse.json({ ok: true });
}

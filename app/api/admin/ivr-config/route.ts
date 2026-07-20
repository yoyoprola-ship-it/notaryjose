import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/app/lib/firebaseAdmin';
import { DEFAULT_IVR_CONFIG, type IvrConfig } from '@/app/lib/ivrDefaults';

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
  const snap = await adminDb.collection('notaryjose_ivr_config').doc('default').get();
  if (!snap.exists) return NextResponse.json(DEFAULT_IVR_CONFIG);
  const saved = snap.data() as Partial<IvrConfig>;
  const merged = { ...DEFAULT_IVR_CONFIG };
  for (const key of Object.keys(DEFAULT_IVR_CONFIG) as (keyof IvrConfig)[]) {
    if (saved[key]) merged[key] = { ...DEFAULT_IVR_CONFIG[key], ...(saved[key] as object) } as never;
  }
  return NextResponse.json(merged);
}

export async function PUT(request: NextRequest) {
  if (!await verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json() as Partial<IvrConfig>;
  const { voices, intro, langPrompt, menu, bookConfirm, bookBye, consultPrompt, consultNoRec, consultBye, retry } = body;
  await adminDb.collection('notaryjose_ivr_config').doc('default').set({
    voices, intro, langPrompt, menu, bookConfirm, bookBye, consultPrompt, consultNoRec, consultBye, retry,
  });
  return NextResponse.json({ ok: true });
}

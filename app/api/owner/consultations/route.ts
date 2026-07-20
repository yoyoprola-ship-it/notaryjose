import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/app/lib/firebaseAdmin';
import { requireOwner } from '@/app/lib/ownerApiAuth';

export async function GET(request: NextRequest) {
  const authError = await requireOwner(request);
  if (authError) return authError;

  try {
    const snap = await adminDb
      .collection('notaryjose_consultations')
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();

    const consultations = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        callerPhone: data.callerPhone as string,
        recordingSid: data.recordingSid as string,
        duration: data.duration as number,
        lang: data.lang as string,
        status: data.status as string,
        createdAt: data.createdAt?.toMillis?.() ?? null,
      };
    });

    return NextResponse.json({ consultations });
  } catch (err) {
    console.error('[owner/consultations] failed:', err);
    return NextResponse.json({ error: 'Failed to load consultations' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const authError = await requireOwner(request);
  if (authError) return authError;

  let body: { id?: string; status?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  if (!body.id || !body.status) return NextResponse.json({ error: 'Missing id or status' }, { status: 400 });

  try {
    await adminDb.collection('notaryjose_consultations').doc(body.id).update({ status: body.status });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[owner/consultations PATCH] failed:', err);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}

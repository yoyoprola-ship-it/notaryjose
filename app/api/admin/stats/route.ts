import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/app/lib/firebaseAdmin';

function monthBounds(offset: 0 | -1) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + offset;
  const start = Timestamp.fromDate(new Date(y, m, 1));
  const end   = Timestamp.fromDate(new Date(y, m + 1, 1));
  const label = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' })
    .format(new Date(y, m, 1));
  const startStr = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const endStr   = new Date(y, m + 1, 0).toISOString().slice(0, 10);
  return { start, end, label, startStr, endStr };
}

async function countBetween(col: string, start: Timestamp, end: Timestamp): Promise<number> {
  const snap = await adminDb.collection(col)
    .where('createdAt', '>=', start)
    .where('createdAt', '<', end)
    .select()
    .get();
  return snap.size;
}

async function getTwilioMinutes(startDate: string, endDate: string): Promise<number> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return 0;
  try {
    const url = new URL(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Usage/Records.json`
    );
    url.searchParams.set('Category',  'calls-inbound');
    url.searchParams.set('StartDate', startDate);
    url.searchParams.set('EndDate',   endDate);
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      },
    });
    if (!res.ok) return 0;
    const data = await res.json() as { usage_records?: { usage?: string }[] };
    return Math.round((parseFloat(data.usage_records?.[0]?.usage ?? '0') || 0) * 10) / 10;
  } catch {
    return 0;
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const decoded = await adminAuth.verifyIdToken(token, true);
    const snap = await adminDb.collection('users').doc(decoded.uid).get();
    if (!snap.exists || (snap.data() as { role?: string })?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Auth error' }, { status: 401 });
  }

  const cur  = monthBounds(0);
  const prev = monthBounds(-1);

  const [
    bookingsCur, bookingsPrev,
    callsCur, callsPrev,
    consultsCur, consultsPrev,
    minutesCur, minutesPrev,
  ] = await Promise.all([
    countBetween('notaryjose_bookings',      cur.start,  cur.end),
    countBetween('notaryjose_bookings',      prev.start, prev.end),
    countBetween('notaryjose_calls',         cur.start,  cur.end),
    countBetween('notaryjose_calls',         prev.start, prev.end),
    countBetween('notaryjose_consultations', cur.start,  cur.end),
    countBetween('notaryjose_consultations', prev.start, prev.end),
    getTwilioMinutes(cur.startStr,  cur.endStr),
    getTwilioMinutes(prev.startStr, prev.endStr),
  ]);

  return NextResponse.json({
    current:  { label: cur.label,  bookings: bookingsCur,  calls: callsCur,  consults: consultsCur,  minutes: minutesCur  },
    previous: { label: prev.label, bookings: bookingsPrev, calls: callsPrev, consults: consultsPrev, minutes: minutesPrev },
  });
}

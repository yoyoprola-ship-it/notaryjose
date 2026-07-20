import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/app/lib/firebaseAdmin';
import { requireOwner } from '@/app/lib/ownerApiAuth';

function monthBounds(offset: 0 | -1) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + offset;
  const start = Timestamp.fromDate(new Date(y, m, 1));
  const end   = Timestamp.fromDate(new Date(y, m + 1, 1));
  const label = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' })
    .format(new Date(y, m, 1));
  return { start, end, label };
}

async function countBetween(col: string, start: Timestamp, end: Timestamp): Promise<number> {
  const snap = await adminDb.collection(col)
    .where('createdAt', '>=', start)
    .where('createdAt', '<', end)
    .select() // no field data, only doc refs
    .get();
  return snap.size;
}

export async function GET(request: NextRequest) {
  const auth = await requireOwner(request);
  if (!auth.ok) return auth.response;

  const cur  = monthBounds(0);
  const prev = monthBounds(-1);

  const [
    bookingsCur, bookingsPrev,
    callsCur, callsPrev,
    consultsCur, consultsPrev,
  ] = await Promise.all([
    countBetween('notaryjose_bookings',      cur.start,  cur.end),
    countBetween('notaryjose_bookings',      prev.start, prev.end),
    countBetween('notaryjose_calls',         cur.start,  cur.end),
    countBetween('notaryjose_calls',         prev.start, prev.end),
    countBetween('notaryjose_consultations', cur.start,  cur.end),
    countBetween('notaryjose_consultations', prev.start, prev.end),
  ]);

  return NextResponse.json({
    current:  { label: cur.label,  bookings: bookingsCur,  calls: callsCur,  consults: consultsCur  },
    previous: { label: prev.label, bookings: bookingsPrev, calls: callsPrev, consults: consultsPrev },
  });
}

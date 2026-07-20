import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
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
  const period   = `${y}-${String(m + 1).padStart(2, '0')}`;
  const startStr = `${period}-01`;
  const endStr   = new Date(y, m + 1, 0).toISOString().slice(0, 10);
  const dueD     = new Date(y, m + 2, 5);
  const dueDate  = `${dueD.getFullYear()}-${String(dueD.getMonth() + 1).padStart(2, '0')}-05`;
  return { start, end, label, period, startStr, endStr, dueDate };
}

async function saveBill(period: string, label: string, bookings: number, minutes: number, dueDate: string) {
  const bookingFee = parseFloat((bookings * 0.85).toFixed(2));
  const minutesFee = parseFloat((minutes * 0.92).toFixed(2));
  const total      = parseFloat((bookingFee + minutesFee).toFixed(2));
  const ref  = adminDb.collection('notaryjose_bills').doc(period);
  const snap = await ref.get();
  if (snap.exists && snap.data()?.status === 'paid') return; // never overwrite paid bills
  const existing = snap.data() ?? {};
  await ref.set({
    period, label, bookings, minutes, bookingFee, minutesFee, total, dueDate,
    status:    existing.status    ?? 'pending',
    paidAt:    existing.paidAt    ?? null,
    createdAt: existing.createdAt ?? FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function countBetween(col: string, start: Timestamp, end: Timestamp): Promise<number> {
  const snap = await adminDb.collection(col)
    .where('createdAt', '>=', start)
    .where('createdAt', '<', end)
    .select()
    .get();
  return snap.size;
}

interface TwilioCallRecord { direction: string; duration: string }

async function getTwilioStats(startDate: string, endDate: string): Promise<{ calls: number; minutes: number }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const rawPhone   = process.env.TWILIO_VOICE_NUMBER ?? process.env.TWILIO_PHONE_NUMBER ?? '';
  if (!accountSid || !authToken || !rawPhone) return { calls: 0, minutes: 0 };

  const digits = rawPhone.replace(/\D/g, '');
  const phone  = digits.length === 10 ? `+1${digits}` : `+${digits}`;
  const creds  = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  let totalSeconds = 0;
  let totalCalls = 0;
  // Twilio query key syntax: "StartTime>=" splits as key="StartTime>" value=date
  let pageUrl: string | null =
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json` +
    `?To=${encodeURIComponent(phone)}&StartTime>=${startDate}&StartTime<=${endDate}&PageSize=100`;

  try {
    while (pageUrl) {
      const res = await fetch(pageUrl, { headers: { Authorization: `Basic ${creds}` } });
      if (!res.ok) break;
      const data = await res.json() as { calls?: TwilioCallRecord[]; next_page_uri?: string | null };
      for (const call of data.calls ?? []) {
        if (call.direction === 'inbound') {
          totalCalls++;
          totalSeconds += parseInt(call.duration ?? '0', 10);
        }
      }
      pageUrl = data.next_page_uri ? `https://api.twilio.com${data.next_page_uri}` : null;
    }
  } catch {
    return { calls: 0, minutes: 0 };
  }

  return { calls: totalCalls, minutes: Math.round((totalSeconds / 60) * 10) / 10 };
}

export async function GET(request: NextRequest) {
  const auth = await requireOwner(request);
  if (!auth.ok) return auth.response;

  const cur  = monthBounds(0);
  const prev = monthBounds(-1);

  const [
    bookingsCur, bookingsPrev,
    consultsCur, consultsPrev,
    twiliocur, twilioprev,
  ] = await Promise.all([
    countBetween('notaryjose_bookings',      cur.start,  cur.end),
    countBetween('notaryjose_bookings',      prev.start, prev.end),
    countBetween('notaryjose_consultations', cur.start,  cur.end),
    countBetween('notaryjose_consultations', prev.start, prev.end),
    getTwilioStats(cur.startStr,  cur.endStr),
    getTwilioStats(prev.startStr, prev.endStr),
  ]);

  // Save bills fire-and-forget — don't slow down the response
  void Promise.all([
    saveBill(cur.period,  cur.label,  bookingsCur,  twiliocur.minutes,  cur.dueDate),
    saveBill(prev.period, prev.label, bookingsPrev, twilioprev.minutes, prev.dueDate),
  ]).catch(() => {});

  return NextResponse.json({
    current:  { label: cur.label,  bookings: bookingsCur,  calls: twiliocur.calls,  consults: consultsCur,  minutes: twiliocur.minutes,  dueDate: cur.dueDate  },
    previous: { label: prev.label, bookings: bookingsPrev, calls: twilioprev.calls, consults: consultsPrev, minutes: twilioprev.minutes, dueDate: prev.dueDate },
  });
}

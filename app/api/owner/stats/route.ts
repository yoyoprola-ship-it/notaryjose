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
  const startStr = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const endDate  = new Date(y, m + 1, 0); // last day of month
  const endStr   = endDate.toISOString().slice(0, 10);
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

  return NextResponse.json({
    current:  { label: cur.label,  bookings: bookingsCur,  calls: twiliocur.calls,  consults: consultsCur,  minutes: twiliocur.minutes  },
    previous: { label: prev.label, bookings: bookingsPrev, calls: twilioprev.calls, consults: consultsPrev, minutes: twilioprev.minutes },
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/app/lib/firebaseAdmin';
import { sendSms } from '@/app/lib/twilioSms';
import { OPERATION_TZ } from '@/app/types';

function nowCT(): { date: string; hour: number } {
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: OPERATION_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  const hour = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: OPERATION_TZ,
      hour: '2-digit',
      hour12: false,
    }).format(now),
    10,
  );
  return { date, hour };
}

function formatHour(h: number): string {
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:00 ${suffix}`;
}

function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 ? `+1${digits}` : `+${digits}`;
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET ?? '';
  if (!secret || request.headers.get('Authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { date: today, hour: currentHour } = nowCT();

  const snap = await adminDb
    .collection('notaryjose_bookings')
    .where('slotDate', '==', today)
    .where('status', '==', 'confirmed')
    .get();

  let sent8am = 0, sent1h = 0, errors = 0;

  for (const doc of snap.docs) {
    const b = doc.data();
    const phone     = toE164(b.customerPhone as string);
    const firstName = (b.customerName as string).split(' ')[0];
    const slotHour  = b.slotHour as number;
    const time      = formatHour(slotHour);

    // 8 AM reminder — send once on the 8am run (or later if cron was down)
    if (currentHour >= 8 && !b.reminder8amSent) {
      try {
        await sendSms(
          phone,
          `Hi ${firstName}, reminder: your notary appointment with Jose Garcia is TODAY at ${time}.\n100 Eva Dr, Lafayette LA\n\nHola ${firstName}, recordatorio: su cita notarial con Jose Garcia es HOY a las ${time}.\n100 Eva Dr, Lafayette LA`,
        );
        await doc.ref.update({ reminder8amSent: true });
        sent8am++;
      } catch {
        errors++;
      }
    }

    // 1-hour reminder — send when the cron runs 1 hour before the slot
    if (slotHour === currentHour + 1 && !b.reminder1hSent) {
      try {
        await sendSms(
          phone,
          `Hi ${firstName}, your notary appointment with Jose Garcia is in 1 HOUR at ${time}.\n100 Eva Dr, Lafayette LA\n\nHola ${firstName}, su cita notarial con Jose Garcia es en 1 HORA a las ${time}.\n100 Eva Dr, Lafayette LA`,
        );
        await doc.ref.update({ reminder1hSent: true });
        sent1h++;
      } catch {
        errors++;
      }
    }
  }

  return NextResponse.json({ ok: true, today, currentHour, sent8am, sent1h, errors });
}

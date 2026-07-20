import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/app/lib/firebaseAdmin';
import { sendSms } from '@/app/lib/twilioSms';
import { OPERATION_TZ } from '@/app/types';

function todayCT(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: OPERATION_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
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

  const today = todayCT();

  const snap = await adminDb
    .collection('notaryjose_bookings')
    .where('slotDate', '==', today)
    .where('status', '==', 'confirmed')
    .get();

  let sent = 0, errors = 0;

  for (const doc of snap.docs) {
    const b = doc.data();
    if (b.reminderSent) continue;

    const phone     = toE164(b.customerPhone as string);
    const firstName = (b.customerName as string).split(' ')[0];
    const time      = formatHour(b.slotHour as number);

    try {
      await sendSms(
        phone,
        `Hi ${firstName}, reminder: your notary appointment with Jose Garcia is TODAY at ${time}.\n100 Eva Dr, Lafayette LA\n\nHola ${firstName}, recordatorio: su cita notarial con Jose Garcia es HOY a las ${time}.\n100 Eva Dr, Lafayette LA`,
      );
      await doc.ref.update({ reminderSent: true });
      sent++;
    } catch {
      errors++;
    }
  }

  return NextResponse.json({ ok: true, today, sent, errors });
}

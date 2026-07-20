import { NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/app/lib/firebaseAdmin';
import { validateTwilioSignature } from '@/app/lib/validateTwilio';
import { sendSms } from '@/app/lib/twilioSms';

const BASE = process.env.SITE_URL ?? 'https://notaryjose.lafayettelamarket.com';

function twiml(xml: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>${xml}`, {
    headers: { 'Content-Type': 'text/xml' },
  });
}

const BYE = {
  en: { voice: 'Polly.Matthew', text: 'Your message has been saved. We will get back to you soon. Goodbye!' },
  es: { voice: 'Polly.Miguel',  text: 'Su mensaje ha sido guardado. Nos comunicaremos pronto con usted. ¡Hasta luego!' },
};

function formatPhone(e164: string): string {
  const d = e164.replace(/\D/g, '').slice(-10);
  if (d.length !== 10) return e164;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export async function POST(request: NextRequest) {
  const lang = (request.nextUrl.searchParams.get('lang') ?? 'en') as 'en' | 'es';
  const formData = await request.formData();
  const params: Record<string, string> = {};
  formData.forEach((v, k) => { params[k] = v.toString(); });

  const authToken = process.env.TWILIO_AUTH_TOKEN ?? '';
  const sig = request.headers.get('X-Twilio-Signature') ?? '';
  const url = `${BASE}/api/twilio/voice/consult-done?lang=${lang}`;
  if (authToken && sig && !validateTwilioSignature(authToken, sig, url, params)) {
    return new Response('Forbidden', { status: 403 });
  }

  const callerE164 = params.From ?? '';
  const recordingUrl = params.RecordingUrl ?? '';
  const recordingSid = params.RecordingSid ?? '';
  const callSid = params.CallSid ?? '';
  const duration = parseInt(params.RecordingDuration ?? '0', 10);

  // Save and notify in parallel — don't block TwiML response
  await Promise.allSettled([
    adminDb.collection('notaryjose_consultations').add({
      callerPhone: callerE164,
      recordingSid,
      recordingUrl,
      duration,
      callSid,
      lang,
      status: 'new',
      createdAt: FieldValue.serverTimestamp(),
    }),
    (async () => {
      const rawOwner = process.env.OWNER_PHONE ?? '';
      const digits = rawOwner.replace(/\D/g, '');
      const ownerE164 = digits.length === 10 ? `+1${digits}` : `+${digits}`;
      const phone = formatPhone(callerE164);
      await sendSms(
        ownerE164,
        `NotaryJose: nueva consulta de voz\n${phone}\nLang: ${lang.toUpperCase()}`,
      );
    })(),
  ]);

  const b = BYE[lang];
  return twiml(`
<Response>
  <Say voice="${b.voice}">${b.text}</Say>
  <Hangup/>
</Response>`);
}

import { NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/app/lib/firebaseAdmin';
import { validateTwilioSignature } from '@/app/lib/validateTwilio';
import { sendSms } from '@/app/lib/twilioSms';

const BASE = process.env.SITE_URL ?? 'https://notaryjose.lafayettelamarket.com';
const SITE_DISPLAY = 'notaryjose dot lafayettelamarket dot com';
const SITE_URL_TEXT = 'https://notaryjose.lafayettelamarket.com';

function twiml(xml: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>${xml}`, {
    headers: { 'Content-Type': 'text/xml' },
  });
}

const COPY = {
  en: {
    voice: 'Polly.Matthew',
    book: `Visit ${SITE_DISPLAY} to book your appointment online. A text message with the link has been sent to your phone.`,
    bookSms: `Book your appointment at ${SITE_URL_TEXT}`,
    bookBye: 'Thank you. Goodbye!',
    consult: 'Please leave your message after the beep. Press pound when you are finished.',
    consultNoRec: 'We did not receive a message. Please try again. Goodbye.',
    consultBye: 'Your message has been saved. We will get back to you soon. Goodbye!',
    retry: 'I did not understand your selection.',
  },
  es: {
    voice: 'Polly.Miguel',
    book: `Visite ${SITE_DISPLAY} para agendar su cita en línea. Se ha enviado un mensaje de texto con el enlace a su teléfono.`,
    bookSms: `Agende su cita en ${SITE_URL_TEXT}`,
    bookBye: '¡Gracias! ¡Hasta luego!',
    consult: 'Por favor deje su mensaje después del tono. Presione numeral cuando haya terminado.',
    consultNoRec: 'No recibimos su mensaje. Por favor intente de nuevo. Hasta luego.',
    consultBye: 'Su mensaje ha sido guardado. Nos comunicaremos pronto con usted. ¡Hasta luego!',
    retry: 'No entendí su selección.',
  },
};

export async function POST(request: NextRequest) {
  const lang = (request.nextUrl.searchParams.get('lang') ?? 'en') as 'en' | 'es';
  const formData = await request.formData();
  const params: Record<string, string> = {};
  formData.forEach((v, k) => { params[k] = v.toString(); });

  const authToken = process.env.TWILIO_AUTH_TOKEN ?? '';
  const sig = request.headers.get('X-Twilio-Signature') ?? '';
  const url = `${BASE}/api/twilio/voice/action?lang=${lang}`;
  if (authToken && sig && !validateTwilioSignature(authToken, sig, url, params)) {
    return new Response('Forbidden', { status: 403 });
  }

  const digits = params.Digits;
  const callerE164 = params.From ?? '';
  const t = COPY[lang];

  // Track engaged calls (chose option 1 or 2) — deduped by CallSid
  if ((digits === '1' || digits === '2') && params.CallSid) {
    void adminDb.collection('notaryjose_calls').doc(params.CallSid).create({
      callerPhone: callerE164,
      callSid: params.CallSid,
      action: digits === '1' ? 'book' : 'consult',
      createdAt: FieldValue.serverTimestamp(),
    }).catch(() => {});
  }

  // Option 1: Book appointment
  if (digits === '1') {
    // Fire-and-forget SMS to caller
    void sendSms(callerE164, t.bookSms);

    return twiml(`
<Response>
  <Say voice="${t.voice}">${t.book}</Say>
  <Pause length="1"/>
  <Say voice="${t.voice}">${t.bookBye}</Say>
  <Hangup/>
</Response>`);
  }

  // Option 2: Voice consultation
  if (digits === '2') {
    return twiml(`
<Response>
  <Say voice="${t.voice}">${t.consult}</Say>
  <Record action="${BASE}/api/twilio/voice/consult-done?lang=${lang}" method="POST" maxLength="120" finishOnKey="#" playBeep="true" timeout="5"/>
  <Say voice="${t.voice}">${t.consultNoRec}</Say>
  <Hangup/>
</Response>`);
  }

  // Unrecognized digit — back to menu
  return twiml(`
<Response>
  <Say voice="${t.voice}">${t.retry}</Say>
  <Redirect>${BASE}/api/twilio/voice/lang-select</Redirect>
</Response>`);
}

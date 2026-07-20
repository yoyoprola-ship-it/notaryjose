import { NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/app/lib/firebaseAdmin';
import { validateTwilioSignature } from '@/app/lib/validateTwilio';
import { sendSms } from '@/app/lib/twilioSms';
import { getIvrConfig } from '@/app/lib/ivrConfig';

const BASE = process.env.SITE_URL ?? 'https://notaryjose.lafayettelamarket.com';
const SITE_URL_TEXT = 'https://notaryjose.lafayettelamarket.com';

function twiml(xml: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>${xml}`, {
    headers: { 'Content-Type': 'text/xml' },
  });
}

const SMS_TEXT = {
  en: `Book your appointment at ${SITE_URL_TEXT}`,
  es: `Agende su cita en ${SITE_URL_TEXT}`,
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

  // Track engaged calls (chose option 1 or 2) — deduped by CallSid
  if ((digits === '1' || digits === '2') && params.CallSid) {
    void adminDb.collection('notaryjose_calls').doc(params.CallSid).create({
      callerPhone: callerE164,
      callSid: params.CallSid,
      action: digits === '1' ? 'book' : 'consult',
      createdAt: FieldValue.serverTimestamp(),
    }).catch(() => {});
  }

  const cfg = await getIvrConfig();
  const voice = cfg.voices[lang];

  // Option 1: Book appointment
  if (digits === '1') {
    void sendSms(callerE164, SMS_TEXT[lang]);
    return twiml(`
<Response>
  <Say voice="${voice}">${cfg.bookConfirm[lang]}</Say>
  <Pause length="1"/>
  <Say voice="${voice}">${cfg.bookBye[lang]}</Say>
  <Hangup/>
</Response>`);
  }

  // Option 2: Voice consultation
  if (digits === '2') {
    return twiml(`
<Response>
  <Say voice="${voice}">${cfg.consultPrompt[lang]}</Say>
  <Record action="${BASE}/api/twilio/voice/consult-done?lang=${lang}" method="POST" maxLength="120" finishOnKey="#" playBeep="true" timeout="5"/>
  <Say voice="${voice}">${cfg.consultNoRec[lang]}</Say>
  <Hangup/>
</Response>`);
  }

  // Unrecognized digit — back to menu
  return twiml(`
<Response>
  <Say voice="${voice}">${cfg.retry[lang]}</Say>
  <Redirect>${BASE}/api/twilio/voice/lang-select</Redirect>
</Response>`);
}

import { NextRequest } from 'next/server';
import { validateTwilioSignature } from '@/app/lib/validateTwilio';

const BASE = process.env.SITE_URL ?? 'https://notaryjose.lafayettelamarket.com';

function twiml(xml: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>${xml}`, {
    headers: { 'Content-Type': 'text/xml' },
  });
}

const MENU = {
  en: { voice: 'Polly.Matthew', text: 'Press 1 to book an appointment. Press 2 to leave a voice consultation.' },
  es: { voice: 'Polly.Miguel',  text: 'Marque uno para agendar una cita. Marque dos para dejar una consulta de voz.' },
};

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const params: Record<string, string> = {};
  formData.forEach((v, k) => { params[k] = v.toString(); });

  const authToken = process.env.TWILIO_AUTH_TOKEN ?? '';
  const sig = request.headers.get('X-Twilio-Signature') ?? '';
  const url = `${BASE}/api/twilio/voice/lang-select`;
  if (authToken && sig && !validateTwilioSignature(authToken, sig, url, params)) {
    return new Response('Forbidden', { status: 403 });
  }

  const lang = params.Digits === '2' ? 'es' : 'en';
  const m = MENU[lang];

  return twiml(`
<Response>
  <Gather numDigits="1" action="${BASE}/api/twilio/voice/action?lang=${lang}" method="POST" timeout="8">
    <Say voice="${m.voice}">${m.text}</Say>
  </Gather>
  <Redirect>${BASE}/api/twilio/voice/welcome</Redirect>
</Response>`);
}

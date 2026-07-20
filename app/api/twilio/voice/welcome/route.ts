import { NextRequest } from 'next/server';
import { validateTwilioSignature } from '@/app/lib/validateTwilio';

const BASE = process.env.SITE_URL ?? 'https://notaryjose.lafayettelamarket.com';

function twiml(xml: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>${xml}`, {
    headers: { 'Content-Type': 'text/xml' },
  });
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const params: Record<string, string> = {};
  formData.forEach((v, k) => { params[k] = v.toString(); });

  const authToken = process.env.TWILIO_AUTH_TOKEN ?? '';
  const sig = request.headers.get('X-Twilio-Signature') ?? '';
  const url = `${BASE}/api/twilio/voice/welcome`;
  if (authToken && sig && !validateTwilioSignature(authToken, sig, url, params)) {
    return new Response('Forbidden', { status: 403 });
  }

  return twiml(`
<Response>
  <Gather numDigits="1" action="${BASE}/api/twilio/voice/lang-select" method="POST" timeout="10">
    <Say voice="Polly.Matthew">Thank you for calling. I am Jose Garcia, notary public in Lafayette, Louisiana.</Say>
    <Pause length="1"/>
    <Say voice="Polly.Miguel">Gracias por llamar. Soy Jose Garcia, notario público en Lafayette, Luisiana.</Say>
    <Pause length="1"/>
    <Say voice="Polly.Matthew">Press 1 for English.</Say>
    <Pause length="1"/>
    <Say voice="Polly.Miguel">Para español, marque dos.</Say>
  </Gather>
  <Redirect>${BASE}/api/twilio/voice/welcome</Redirect>
</Response>`);
}

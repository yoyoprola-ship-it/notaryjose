import { NextRequest } from 'next/server';
import { getIvrConfig } from '@/app/lib/ivrConfig';

function twiml(xml: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>${xml}`, {
    headers: { 'Content-Type': 'text/xml' },
  });
}

export async function POST(request: NextRequest) {
  const lang = (request.nextUrl.searchParams.get('lang') ?? 'en') as 'en' | 'es';
  const formData = await request.formData();
  const dialStatus = (formData.get('DialCallStatus') as string) ?? '';

  if (dialStatus === 'completed') {
    return twiml(`<Response><Hangup/></Response>`);
  }

  const cfg = await getIvrConfig();
  return twiml(`
<Response>
  <Say voice="${cfg.voices[lang]}">${cfg.directBusy[lang]}</Say>
  <Hangup/>
</Response>`);
}

import { NextRequest } from 'next/server';
import { requireOwner } from '@/app/lib/ownerApiAuth';

export async function GET(request: NextRequest) {
  const authError = await requireOwner(request);
  if (authError) return authError;

  const sid = request.nextUrl.searchParams.get('sid');
  if (!sid || !/^RE[a-f0-9]{32}$/.test(sid)) {
    return new Response('Invalid recording SID', { status: 400 });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    return new Response('Twilio credentials missing', { status: 500 });
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${sid}.mp3`;
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      },
    });
    if (!res.ok) return new Response('Recording not found', { status: 404 });
    return new Response(res.body, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (err) {
    console.error('[consultations/audio] proxy failed:', err);
    return new Response('Failed to fetch recording', { status: 500 });
  }
}

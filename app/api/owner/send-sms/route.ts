import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/app/lib/ownerApiAuth';
import { sendSms } from '@/app/lib/twilioSms';
import { getClientIp, rateLimitOr429 } from '@/app/lib/rateLimit';

export async function POST(request: NextRequest) {
  const authError = await requireOwner(request);
  if (authError) return authError;

  const ip = getClientIp(request.headers);
  const rl = await rateLimitOr429(`nj-owner-send-sms:${ip}`, { maxRequests: 10, windowMs: 60_000 });
  if (rl) return rl;

  let body: { to?: string; message?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  const digits = (body.to ?? '').replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) return NextResponse.json({ error: 'Invalid phone' }, { status: 400 });

  const message = (body.message ?? '').trim();
  if (!message || message.length > 1600) return NextResponse.json({ error: 'Invalid message' }, { status: 400 });

  await sendSms(`+1${digits}`, message);
  return NextResponse.json({ ok: true });
}

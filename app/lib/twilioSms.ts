// Shared Twilio SMS sender used by notifyOwner, IVR webhooks, and owner reply.
export async function sendSms(to: string, body: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!accountSid || !authToken || !from) {
    console.warn('[twilioSms] Missing credentials — skipping');
    return;
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams({ To: to, From: from, Body: body });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      },
      body: params.toString(),
      signal: controller.signal,
    });
    if (!res.ok) {
      const r = await res.json().catch(() => ({}));
      console.error('[twilioSms] error:', { status: res.status, code: r?.code });
    }
  } catch (err) {
    console.error('[twilioSms] failed:', err);
  } finally {
    clearTimeout(timer);
  }
}

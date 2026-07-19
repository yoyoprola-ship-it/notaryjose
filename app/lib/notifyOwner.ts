// Notificaciones al OWNER_PHONE vía Twilio. Fire-and-forget.

interface BookingNotifyPayload {
  customerName: string;
  customerPhone: string;      // 10 dígitos
  slotIso: string;            // "YYYY-MM-DDTHH:00:00"
}

export async function notifyOwnerOfBooking(
  b: BookingNotifyPayload
): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  const rawOwner = process.env.OWNER_PHONE;

  if (!accountSid || !authToken || !fromNumber || !rawOwner) {
    console.warn(
      '[notifyOwner] Missing Twilio/OWNER_PHONE — skipping SMS'
    );
    return;
  }

  const digits = rawOwner.replace(/\D/g, '');
  let toE164: string;
  if (digits.length === 10) toE164 = `+1${digits}`;
  else if (digits.length === 11 && digits.startsWith('1'))
    toE164 = `+${digits}`;
  else toE164 = `+${digits}`;

  const body = buildBody(b);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const params = new URLSearchParams({
      To: toE164,
      From: fromNumber,
      Body: body,
    });
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${accountSid}:${authToken}`
        ).toString('base64')}`,
      },
      body: params.toString(),
      signal: controller.signal,
    });
    if (!res.ok) {
      const r = await res.json().catch(() => ({}));
      console.error('[notifyOwner] Twilio error:', {
        code: r?.code,
        status: res.status,
      });
      return;
    }
    console.log('[notifyOwner] SMS sent to owner');
  } catch (err) {
    console.error('[notifyOwner] SMS send failed:', err);
  } finally {
    clearTimeout(timer);
  }
}

function buildBody(b: BookingNotifyPayload): string {
  const phone = formatPhone(b.customerPhone);
  const when = formatSlot(b.slotIso);
  return [
    'NotaryJose: new appointment',
    `${b.customerName} · ${phone}`,
    when,
    'https://notaryjose.lafayettelamarket.com/admin/bookings',
  ].join('\n');
}

function formatPhone(p: string): string {
  const d = (p || '').replace(/\D/g, '').slice(-10);
  if (d.length !== 10) return p;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

// "2026-07-18T14:00:00" → "Sat Jul 18, 2 PM"
function formatSlot(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):/);
  if (!m) return iso;
  const [, y, mo, d, hh] = m;
  const h = parseInt(hh, 10);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const twelve = h % 12 === 0 ? 12 : h % 12;
  const date = new Date(`${y}-${mo}-${d}T12:00:00`);
  const dow = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'America/Chicago',
  }).format(date);
  const monthName = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    timeZone: 'America/Chicago',
  }).format(date);
  return `${dow} ${monthName} ${parseInt(d, 10)}, ${twelve} ${suffix}`;
}

'use client';
import { useRef, useState } from 'react';
import {
  confirmSmsCode,
  sendSmsCode,
  setupRecaptcha,
  signOut,
} from '@/app/lib/auth';
import { auth } from '@/app/lib/firebase';
import { formatDateShort, formatSlotRange } from '@/app/lib/timeSlots';
import type { Booking } from '@/app/types';

type Lang = 'en' | 'es';
type Step = 'idle' | 'phone' | 'code' | 'bookings';

const COPY: Record<Lang, {
  trigger: string;
  title: string;
  subtitle: string;
  step1: string;
  step2: (phone: string) => string;
  phoneLabel: string;
  sendCode: string;
  sending: string;
  verify: string;
  verifying: string;
  noBookings: string;
  cancelBtn: string;
  cancelling: string;
  cancelled: string;
  changePhone: string;
  close: string;
  errorPhone: string;
  errorCode: string;
  errorWrongCode: string;
  errorGeneral: string;
  when: string;
}> = {
  en: {
    trigger: 'Cancel an appointment',
    title: 'Cancel your appointment',
    subtitle: 'Verify your phone to see your upcoming appointments.',
    step1: 'Step 1 of 2 — Enter your phone number',
    step2: (p) => `Step 2 of 2 — Enter the code sent to ${p}`,
    phoneLabel: 'Phone number',
    sendCode: 'Send code',
    sending: 'Sending…',
    verify: 'Verify',
    verifying: 'Verifying…',
    noBookings: 'No upcoming appointments found for this number.',
    cancelBtn: 'Cancel appointment',
    cancelling: 'Cancelling…',
    cancelled: 'Cancelled',
    changePhone: '← Change phone',
    close: 'Close',
    errorPhone: 'Enter a valid 10-digit US phone.',
    errorCode: 'Code must be 6 digits.',
    errorWrongCode: 'Wrong or expired code.',
    errorGeneral: 'Something went wrong. Please try again.',
    when: 'When',
  },
  es: {
    trigger: 'Cancelar una cita',
    title: 'Cancelar tu cita',
    subtitle: 'Verificá tu teléfono para ver tus próximas citas.',
    step1: 'Paso 1 de 2 — Ingresá tu número de teléfono',
    step2: (p) => `Paso 2 de 2 — Ingresá el código enviado al ${p}`,
    phoneLabel: 'Número de teléfono',
    sendCode: 'Enviar código',
    sending: 'Enviando…',
    verify: 'Verificar',
    verifying: 'Verificando…',
    noBookings: 'No se encontraron citas próximas para este número.',
    cancelBtn: 'Cancelar cita',
    cancelling: 'Cancelando…',
    cancelled: 'Cancelada',
    changePhone: '← Cambiar teléfono',
    close: 'Cerrar',
    errorPhone: 'Ingresá un teléfono US válido de 10 dígitos.',
    errorCode: 'El código debe tener 6 dígitos.',
    errorWrongCode: 'Código incorrecto o expirado.',
    errorGeneral: 'Algo salió mal. Intentá de nuevo.',
    when: 'Cuándo',
  },
};

function formatPhoneDisplay(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export default function CancelSection({ lang }: { lang: Lang }) {
  const t = COPY[lang];
  const [step, setStep] = useState<Step>('idle');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelledIds, setCancelledIds] = useState<Set<string>>(new Set());
  const recaptchaRef = useRef<HTMLDivElement>(null);

  const reset = async () => {
    try { await signOut(); } catch { /* ignore */ }
    setStep('idle');
    setPhone('');
    setCode('');
    setError('');
    setBookings([]);
    setCancelledIds(new Set());
  };

  const handleSendSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) { setError(t.errorPhone); return; }
    setLoading(true);
    try {
      if (!recaptchaRef.current) throw new Error('reCAPTCHA missing');
      setupRecaptcha(recaptchaRef.current.id);
      await sendSmsCode(digits);
      setStep('code');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.errorGeneral);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (code.length !== 6) { setError(t.errorCode); return; }
    setLoading(true);
    setError('');
    try {
      const user = await confirmSmsCode(code);
      const idToken = await user.getIdToken();
      const res = await fetch('/api/my-bookings', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t.errorGeneral);
      setBookings(data.bookings as Booking[]);
      setStep('bookings');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.errorGeneral;
      if (msg.includes('invalid-verification-code') || msg.includes('code-expired')) {
        setError(t.errorWrongCode);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (b: Booking) => {
    if (cancellingId) return;
    setCancellingId(b.id);
    setError('');
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error(t.errorGeneral);
      const res = await fetch('/api/cancel-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ bookingId: b.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t.errorGeneral);
      setCancelledIds((prev) => new Set([...prev, b.id]));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.errorGeneral);
    } finally {
      setCancellingId(null);
    }
  };

  if (step === 'idle') {
    return (
      <section id="cancel" className="px-6 py-10 bg-white border-t border-stone-200">
        <div className="max-w-2xl mx-auto text-center">
          <button
            onClick={() => setStep('phone')}
            className="px-6 py-3 border border-stone-300 hover:border-slate-500 rounded text-sm font-bold uppercase tracking-wide text-slate-700 transition-colors"
          >
            {t.trigger}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section id="cancel" className="px-6 py-16 bg-white border-t border-stone-200">
      <div className="max-w-md mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 mb-1">
              {t.title}
            </h2>
            {step !== 'bookings' && (
              <p className="text-sm text-slate-500">{t.subtitle}</p>
            )}
          </div>
          <button
            onClick={reset}
            className="text-xs text-slate-400 hover:text-slate-700 ml-4 mt-1"
          >
            {t.close}
          </button>
        </div>

        {/* Step indicators */}
        {step !== 'bookings' && (
          <>
            <div className="flex gap-1.5 mb-4">
              {[0, 1].map((i) => {
                const idx = step === 'phone' ? 0 : 1;
                return (
                  <div key={i} className={`h-1 flex-1 rounded ${i <= idx ? 'bg-amber-700' : 'bg-stone-200'}`} />
                );
              })}
            </div>
            <p className="text-xs text-slate-500 mb-6">
              {step === 'phone' ? t.step1 : t.step2(phone)}
            </p>
          </>
        )}

        {step === 'phone' && (
          <form onSubmit={handleSendSms} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                {t.phoneLabel}
              </label>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-sm">+1</span>
                <input
                  type="tel" inputMode="tel" autoComplete="tel"
                  placeholder="(337) 123-4567"
                  value={formatPhoneDisplay(phone)}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={loading} required className={inputCls}
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading} className={btnCls}>
              {loading ? t.sending : t.sendCode}
            </button>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={handleVerifySms} className="flex flex-col gap-4">
            <input
              type="text" inputMode="numeric" autoComplete="one-time-code"
              pattern="[0-9]{6}" placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              disabled={loading} required autoFocus
              className={`${inputCls} text-center text-2xl font-black tracking-[0.5em]`}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading || code.length !== 6} className={btnCls}>
              {loading ? t.verifying : t.verify}
            </button>
            <button
              type="button"
              onClick={() => { setStep('phone'); setCode(''); setError(''); }}
              disabled={loading}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              {t.changePhone}
            </button>
          </form>
        )}

        {step === 'bookings' && (
          <div>
            {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
            {bookings.length === 0 ? (
              <p className="text-sm text-slate-500">{t.noBookings}</p>
            ) : (
              <div className="flex flex-col gap-3">
                {bookings.map((b) => {
                  const isCancelled = cancelledIds.has(b.id);
                  const isBusy = cancellingId === b.id;
                  return (
                    <div
                      key={b.id}
                      className={`border rounded-lg p-4 flex items-center justify-between gap-4 transition-opacity ${
                        isCancelled ? 'border-stone-200 opacity-50' : 'border-amber-200 bg-amber-50/30'
                      } ${isBusy ? 'opacity-60' : ''}`}
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-900">{b.customerName}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          <span className="font-bold uppercase tracking-wider mr-1">{t.when}</span>
                          {formatDateShort(b.slotDate)} · {formatSlotRange(b.slotHour)}
                        </p>
                      </div>
                      {isCancelled ? (
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 shrink-0">
                          {t.cancelled}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleCancel(b)}
                          disabled={!!cancellingId}
                          className="shrink-0 px-3 py-1.5 border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-40 rounded text-xs font-bold uppercase tracking-wide"
                        >
                          {isBusy ? t.cancelling : t.cancelBtn}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div id="notaryjose-cancel-recaptcha" ref={recaptchaRef} />
      </div>
    </section>
  );
}

const inputCls =
  'w-full px-4 py-3 bg-white border border-stone-300 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-700 focus:ring-1 focus:ring-amber-700 transition-colors';

const btnCls =
  'w-full px-4 py-3 bg-amber-800 hover:bg-amber-900 active:bg-amber-950 text-white font-bold uppercase tracking-wide rounded-md transition-colors disabled:opacity-50';

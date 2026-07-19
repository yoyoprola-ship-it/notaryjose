'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import {
  confirmSmsCode,
  onAuthChange,
  sendSmsCode,
  setupRecaptcha,
  signOut,
} from '@/app/lib/auth';
import { db } from '@/app/lib/firebase';

const OWNER_SESSION_WINDOW_MS = 8 * 60 * 60 * 1000;
type Step = 'phone' | 'code';

export default function OwnerLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkingAuth, setCheckingAuth] = useState(true);
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const userInitiated = useRef(false);

  useEffect(() => {
    const unsub = onAuthChange(async (user) => {
      if (userInitiated.current) return;
      if (!user) { setCheckingAuth(false); return; }
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const sessionAt = snap.data()?.notaryjoseOwnerSessionAt;
          const sessionMs = sessionAt?.toMillis?.() ?? 0;
          if (sessionMs && Date.now() - sessionMs < OWNER_SESSION_WINDOW_MS) {
            router.replace('/owner');
            return;
          }
        }
      } catch { /* no session doc yet — show login */ }
      setCheckingAuth(false);
    });
    return () => unsub();
  }, [router]);

  const formatPhoneDisplay = (v: string): string => {
    const d = v.replace(/\D/g, '').slice(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  };

  const handleSendSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) {
      setError('Enter a valid 10-digit US phone.');
      return;
    }
    userInitiated.current = true;
    setLoading(true);
    try {
      const preRes = await fetch('/api/owner/check-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: digits }),
      });
      const preData = await preRes.json().catch(() => ({}));
      if (!preRes.ok) {
        setError(preData.error || 'Could not verify phone.');
        setLoading(false);
        return;
      }
      if (!preData.canLogin) {
        setError('This phone is not authorized.');
        setLoading(false);
        return;
      }
      if (!recaptchaRef.current) throw new Error('reCAPTCHA missing');
      setupRecaptcha(recaptchaRef.current.id);
      await sendSmsCode(digits);
      setStep('code');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    if (code.length !== 6) { setError('Code must be 6 digits.'); return; }
    setLoading(true);
    try {
      const user = await confirmSmsCode(code);
      const idToken = await user.getIdToken();
      const res = await fetch('/api/owner/grant-session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'This phone is not authorized for this panel.');
        try { await signOut(); } catch { /* ignore */ }
        setLoading(false);
        return;
      }
      router.replace('/owner');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      if (msg.includes('invalid-verification-code') || msg.includes('code-expired')) {
        setError('Wrong or expired code.');
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-stone-50 text-slate-500">
        Loading…
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-stone-50 text-slate-900 px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 mb-1">
          Notary Jose
        </h1>
        <div className="w-12 h-1 bg-amber-700 mb-8" />
        <h2 className="text-lg font-bold mb-1 text-slate-600">Owner sign in</h2>
        <div className="flex gap-1.5 mb-5">
          {[0, 1].map((i) => {
            const stepIdx = step === 'phone' ? 0 : 1;
            return (
              <div
                key={i}
                className={`h-1 flex-1 rounded ${i <= stepIdx ? 'bg-amber-700' : 'bg-stone-200'}`}
              />
            );
          })}
        </div>
        <p className="text-xs text-slate-500 mb-6">
          {step === 'phone' && "Step 1 of 2 — We'll text you a verification code."}
          {step === 'code' && `Step 2 of 2 — Enter the 6-digit code sent to ${phone}.`}
        </p>

        {step === 'phone' && (
          <form onSubmit={handleSendSms} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Phone number
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
              {loading ? 'Sending…' : 'Send code'}
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
              {loading ? 'Verifying…' : 'Enter owner panel'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('phone'); setCode(''); setError(''); }}
              disabled={loading}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              ← Change phone number
            </button>
          </form>
        )}

        <div id="notaryjose-owner-recaptcha" ref={recaptchaRef} />
      </div>
    </main>
  );
}

const inputCls =
  'w-full px-4 py-3 bg-white border border-stone-300 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-700 focus:ring-1 focus:ring-amber-700 transition-colors';

const btnCls =
  'w-full px-4 py-3 bg-amber-800 hover:bg-amber-900 active:bg-amber-950 text-white font-bold uppercase tracking-wide rounded-md transition-colors disabled:opacity-50';

'use client';
import { useEffect, useRef, useState } from 'react';
import {
  confirmSmsCode,
  onAuthChange,
  sendSmsCode,
  setupRecaptcha,
} from '@/app/lib/auth';
import { auth } from '@/app/lib/firebase';
import type { User } from 'firebase/auth';

// Multi-step modal for booking a slot.
//   1. details  — customer enters name + phone
//   2. code     — SMS verify
//   3. success  — booking confirmed
//
// Bilingual copy via `t`.

export interface BookingCopy {
  title: string;
  step1of3: string;
  step2of3: string;
  done: string;
  namePlaceholder: string;
  phonePlaceholder: string;
  sendCode: string;
  sending: string;
  codePlaceholder: string;
  verify: string;
  verifying: string;
  bookedTitle: string;
  bookedBody: (whenLabel: string) => string;
  close: string;
  changeNumber: string;
  requiredName: string;
  requiredPhone: string;
  requiredNotes: string;
  invalidCode: string;
  wrongCode: string;
  bookingConflict: string;
  networkError: string;
  slotClosedHint: string;
  bookingWith: (whenLabel: string) => string;
  notesLabel: string;
  notesPlaceholder: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  slotIso: string;
  slotLabel: string;
  t: BookingCopy;
  onBookedRefresh?: () => void;
}

type Step = 'details' | 'code' | 'success';

export default function BookingModal({
  open,
  onClose,
  slotIso,
  slotLabel,
  t,
  onBookedRefresh,
}: Props) {
  const [step, setStep] = useState<Step>('details');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const userInitiated = useRef(false);

  useEffect(() => {
    if (!open) return;
    const unsub = onAuthChange((u) => setUser(u));
    return () => unsub();
  }, [open]);

  useEffect(() => {
    if (open) {
      setStep('details');
      setCode('');
      setError('');
      // Nota: NO reseteamos name/phone/notes al reabrir para que si el
      // customer cambia de slot sin cerrar el modal, no re-tipee todo.
      userInitiated.current = false;
    }
  }, [open, slotIso]);

  const formatPhoneDisplay = (v: string): string => {
    const d = v.replace(/\D/g, '').slice(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    const cleanName = name.trim();
    if (cleanName.length < 2) {
      setError(t.requiredName);
      return;
    }
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) {
      setError(t.requiredPhone);
      return;
    }
    if (notes.trim().length < 5) {
      setError(t.requiredNotes);
      return;
    }
    userInitiated.current = true;
    setLoading(true);
    try {
      if (!recaptchaRef.current) throw new Error('reCAPTCHA missing');
      setupRecaptcha(recaptchaRef.current.id);
      await sendSmsCode(digits);
      setStep('code');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.networkError;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    if (code.length !== 6) {
      setError(t.invalidCode);
      return;
    }
    setLoading(true);
    try {
      await confirmSmsCode(code);
      // Now call the server to actually create the booking
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error(t.networkError);
      const res = await fetch('/api/create-booking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          slot: slotIso,
          customerName: name.trim(),
          notes: notes.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409) setError(t.bookingConflict);
        else setError(data.error || t.networkError);
        setLoading(false);
        return;
      }
      setStep('success');
      onBookedRefresh?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.networkError;
      if (msg.includes('invalid-verification-code') || msg.includes('code-expired')) {
        setError(t.wrongCode);
      } else {
        setError(msg);
      }
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-white border border-stone-200 w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
              {step === 'details' && t.step1of3}
              {step === 'code' && t.step2of3}
              {step === 'success' && t.done}
            </p>
            <h2 className="text-lg font-black tracking-tight text-slate-900">
              {t.title}
            </h2>
            {step !== 'success' && (
              <p className="text-xs text-slate-500 mt-1">{t.bookingWith(slotLabel)}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-800 text-2xl"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          {step === 'details' && (
            <form onSubmit={handleSendCode} className="flex flex-col gap-4">
              <input
                type="text"
                autoComplete="name"
                placeholder={t.namePlaceholder}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                required
                autoFocus
                maxLength={80}
                className={inputCls}
              />
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-sm">+1</span>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder={t.phonePlaceholder}
                  value={formatPhoneDisplay(phone)}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={loading}
                  required
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  {t.notesLabel}
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={loading}
                  rows={3}
                  maxLength={500}
                  placeholder={t.notesPlaceholder}
                  className={`${inputCls} resize-none`}
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={loading} className={btnCls}>
                {loading ? t.sending : t.sendCode}
              </button>
            </form>
          )}

          {step === 'code' && (
            <form onSubmit={handleVerifyCode} className="flex flex-col gap-4">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                placeholder={t.codePlaceholder}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={loading}
                required
                autoFocus
                className={`${inputCls} text-center text-2xl font-black tracking-[0.5em]`}
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className={btnCls}
              >
                {loading ? t.verifying : t.verify}
              </button>
              <button
                type="button"
                onClick={() => { setStep('details'); setCode(''); setError(''); }}
                disabled={loading}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                {t.changeNumber}
              </button>
            </form>
          )}

          {step === 'success' && (
            <div className="text-center py-4">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center text-amber-800 text-3xl">
                ✓
              </div>
              <p className="text-lg font-black uppercase text-slate-900 mb-2">
                {t.bookedTitle}
              </p>
              <p className="text-sm text-slate-600 mb-6">
                {t.bookedBody(slotLabel)}
              </p>
              <button
                onClick={() => { onClose(); }}
                className={btnCls}
              >
                {t.close}
              </button>
            </div>
          )}
        </div>

        <div id="notaryjose-booking-recaptcha" ref={recaptchaRef} />
        {/* Prevent unused user warning; used to skip re-verify if already signed in later */}
        <input type="hidden" value={user?.uid || ''} />
      </div>
    </div>
  );
}

const inputCls =
  'w-full px-4 py-3 bg-white border border-stone-300 rounded text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-700 focus:ring-1 focus:ring-amber-700 transition';

const btnCls =
  'w-full px-4 py-3 bg-amber-800 hover:bg-amber-900 active:bg-amber-950 text-white font-bold uppercase tracking-wide rounded transition-colors disabled:opacity-50';

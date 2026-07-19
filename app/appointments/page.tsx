'use client';
import { useState } from 'react';
import Link from 'next/link';
import AppointmentSection, { APPT_COPY } from '@/app/components/AppointmentSection';
import CancelSection from '@/app/components/CancelSection';

// Standalone /appointments — mismo AppointmentSection que la home,
// solo con topbar propio para navegación directa. La home tiene
// el mismo widget embebido después de servicios.

type Lang = 'en' | 'es';

const NAV: Record<Lang, { back: string; toggle: string }> = {
  en: { back: '← Back to home', toggle: 'ES' },
  es: { back: '← Volver al inicio', toggle: 'EN' },
};

export default function AppointmentsPage() {
  const [lang, setLang] = useState<Lang>('en');
  void APPT_COPY; // reuse guarantee — the export lives here for type safety

  return (
    <main className="min-h-screen flex flex-col bg-stone-50">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            {NAV[lang].back}
          </Link>
          <button
            onClick={() => setLang(lang === 'en' ? 'es' : 'en')}
            className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-800 border border-amber-300 hover:bg-amber-50 rounded"
          >
            {NAV[lang].toggle}
          </button>
        </div>
      </header>
      <AppointmentSection lang={lang} />
      <CancelSection lang={lang} />
    </main>
  );
}
